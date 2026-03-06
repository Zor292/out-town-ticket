const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} = require('discord.js');

const config = require('./config');
const db     = require('./database');

const Database = require('better-sqlite3');
const path     = require('path');
const _db      = new Database(path.join(__dirname, '..', 'outtown.db'));

function footer() {
  return { text: config.FOOTER_TEXT, iconURL: config.FOOTER_ICON };
}

function getTicketById(id) {
  return _db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
}

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setImage(config.SERVER_ICON)
    .setFooter(footer());

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_type_select')
    .setPlaceholder('اختر نوع التذكرة')
    .addOptions(
      config.TICKET_TYPES.map(t => ({
        label: t.label,
        description: t.description,
        value: t.id,
        emoji: t.emoji,
      }))
    );

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
}

async function openTicket(interaction, ticketType) {
  const guild  = interaction.guild;
  const opener = interaction.user;
  const type   = config.TICKET_TYPES.find(t => t.id === ticketType);

  if (!type) return interaction.reply({ content: 'نوع التذكرة غير معروف.', ephemeral: true });

  const existing = guild.channels.cache.find(
    c => c.topic && c.topic.includes(opener.id) && c.topic.includes(`type:${ticketType}`) && c.parentId === config.TICKET_CATEGORY_ID
  );
  if (existing) {
    return interaction.reply({ content: `لديك تذكرة مفتوحة: <#${existing.id}>`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketNum   = db.getNextTicketNumber(guild.id);
  const channelName = `${ticketType}-${ticketNum}`;
  const adminRoleId = config.TICKET_ROLES[ticketType] || config.TICKET_ROLES.support;

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.TICKET_CATEGORY_ID,
    topic: `opener:${opener.id} | type:${ticketType} | num:${ticketNum}`,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: opener.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: adminRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ],
  });

  db.createTicket({ channelId: ticketChannel.id, guildId: guild.id, openerId: opener.id, type: ticketType });

  const welcome = config.TICKET_WELCOME[ticketType] || config.TICKET_WELCOME.support;

  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle(welcome.title)
    .setDescription(welcome.description + `\n\n<@${opener.id}>`)
    .setImage(config.SERVER_ICON)
    .setFooter(footer())
    .setTimestamp();

  const btns = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_call_upper').setLabel('استدعاء عليا').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_call_support').setLabel('استدعاء سبورت').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('استلام التكت').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_lock').setLabel('اغلاق').setStyle(ButtonStyle.Secondary),
  );

  const dropdown = new StringSelectMenuBuilder()
    .setCustomId('ticket_manage_menu')
    .setPlaceholder('تعديل التذكرة')
    .addOptions([
      { label: 'استدعاء صاحب التذكرة', value: 'call_opener',   description: 'منشن فاتح التذكرة' },
      { label: 'تعديل اسم التذكرة',    value: 'rename',        description: 'تغيير اسم القناة' },
      { label: 'اضافة عضو',            value: 'add_member',    description: 'اضافة عضو للتذكرة' },
      { label: 'ازالة عضو',            value: 'remove_member', description: 'ازالة عضو من التذكرة' },
    ]);

  const manageRow = new ActionRowBuilder().addComponents(dropdown);

  await ticketChannel.send({
    content: `<@${opener.id}> | <@&${adminRoleId}>`,
    embeds: [embed],
    components: [btns, manageRow],
  });

  await logAction(guild, {
    title: 'تذكرة جديدة',
    description: `**فاتح التذكرة:** <@${opener.id}>\n**النوع:** ${type.label}\n**القناة:** <#${ticketChannel.id}>\n**الرقم:** #${ticketNum}`,
  });

  await interaction.editReply({ content: `تم فتح تذكرتك: <#${ticketChannel.id}>` });
}

async function handleManageMenu(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'هذه القناة ليست تذكرة.', ephemeral: true });

  const value       = interaction.values[0];
  const adminRoleId = config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support;
  const isAdmin     = interaction.member.roles.cache.has(adminRoleId);

  if (value === 'call_opener') {
    await interaction.reply({ content: `<@${ticket.opener_id}>` });
    return;
  }

  if (!isAdmin) {
    return interaction.reply({ content: 'هذا الخيار للإدارة فقط.', ephemeral: true });
  }

  if (value === 'rename') {
    await interaction.reply({
      content: 'أرسل الاسم الجديد للتذكرة في هذه القناة خلال 30 ثانية.',
      ephemeral: true,
    });
    const collector = interaction.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, time: 30000, max: 1 });
    collector.on('collect', async msg => {
      const newName = msg.content.slice(0, 100).replace(/[^a-zA-Z0-9\u0600-\u06FF\-_]/g, '-');
      await interaction.channel.setName(newName).catch(() => {});
      await msg.delete().catch(() => {});
      await interaction.channel.send({ content: `تم تغيير اسم التذكرة إلى **${newName}**` });
    });
    return;
  }

  if (value === 'add_member') {
    await interaction.reply({ content: 'منشن العضو الذي تريد إضافته خلال 30 ثانية.', ephemeral: true });
    const collector = interaction.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, time: 30000, max: 1 });
    collector.on('collect', async msg => {
      const mentioned = msg.mentions.members.first();
      if (!mentioned) { await msg.delete().catch(() => {}); return; }
      await interaction.channel.permissionOverwrites.edit(mentioned.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      });
      await msg.delete().catch(() => {});
      await interaction.channel.send({ content: `تم إضافة <@${mentioned.id}> للتذكرة.` });
    });
    return;
  }

  if (value === 'remove_member') {
    await interaction.reply({ content: 'منشن العضو الذي تريد إزالته خلال 30 ثانية.', ephemeral: true });
    const collector = interaction.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, time: 30000, max: 1 });
    collector.on('collect', async msg => {
      const mentioned = msg.mentions.members.first();
      if (!mentioned || mentioned.id === ticket.opener_id) { await msg.delete().catch(() => {}); return; }
      await interaction.channel.permissionOverwrites.delete(mentioned.id).catch(() => {});
      await msg.delete().catch(() => {});
      await interaction.channel.send({ content: `تم إزالة <@${mentioned.id}> من التذكرة.` });
    });
    return;
  }
}

async function handleCallUpper(interaction) {
  await interaction.reply({ content: `<@&${config.UPPER_ROLE}>` });
}

async function handleCallSupport(interaction) {
  const ticket      = db.getTicketByChannel(interaction.channel.id);
  const adminRoleId = ticket ? (config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support) : config.TICKET_ROLES.support;
  await interaction.reply({ content: `<@&${adminRoleId}>` });
}

async function handleLockButton(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'هذه القناة ليست تذكرة.', ephemeral: true });

  const adminRoleId = config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support;
  const canClose    = interaction.member.roles.cache.has(adminRoleId) || ticket.opener_id === interaction.user.id;
  if (!canClose) return interaction.reply({ content: 'ليس لديك صلاحية لإغلاق هذه التذكرة.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('تأكيد اغلاق التذكرة')
    .setDescription('هل أنت متأكد من اغلاق هذه التذكرة؟ سيتم ارسال طلب تقييم للعضو.')
    .setFooter(footer())
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_lock_confirm').setLabel('تأكيد').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_lock_cancel').setLabel('إلغاء').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleLockConfirm(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'هذه القناة ليست تذكرة.', ephemeral: true });

  db.closeTicket({ channelId: interaction.channel.id, closerId: interaction.user.id });

  await interaction.channel.permissionOverwrites.edit(ticket.opener_id, { SendMessages: false }).catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('تم اغلاق التذكرة')
    .setDescription(`تم اغلاق هذه التذكرة بواسطة <@${interaction.user.id}>`)
    .setFooter(footer())
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [] });

  await sendRatingEmbed(interaction.channel, ticket, interaction.user, 'ticket');

  try {
    const opener = await interaction.client.users.fetch(ticket.opener_id);
    await sendRatingEmbed(null, ticket, interaction.user, 'dm', opener);
  } catch (_) {}

  await logAction(interaction.guild, {
    title: 'تذكرة مغلقة',
    description: `**القناة:** <#${interaction.channel.id}>\n**أُغلقت بواسطة:** <@${interaction.user.id}>\n**فاتح التذكرة:** <@${ticket.opener_id}>`,
  });
}

async function handleClaimButton(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'هذه القناة ليست تذكرة.', ephemeral: true });

  const adminRoleId = config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support;
  if (!interaction.member.roles.cache.has(adminRoleId)) {
    return interaction.reply({ content: 'ليس لديك صلاحية لاستلام هذه التذكرة.', ephemeral: true });
  }

  db.setTicketAdmin(interaction.channel.id, interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setDescription(`تم استلام التذكرة من قبل <@${interaction.user.id}>`)
    .setFooter(footer())
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  await logAction(interaction.guild, {
    title: 'استلام تذكرة',
    description: `**القناة:** <#${interaction.channel.id}>\n**المستلم:** <@${interaction.user.id}>`,
  });
}

async function handleDeleteButton(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'هذه القناة ليست تذكرة.', ephemeral: true });

  const adminRoleId = config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support;
  if (!interaction.member.roles.cache.has(adminRoleId)) {
    return interaction.reply({ content: 'ليس لديك صلاحية لحذف هذه التذكرة.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('تأكيد حذف التذكرة')
    .setDescription('هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.')
    .setFooter(footer())
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_delete_confirm').setLabel('تأكيد الحذف').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_delete_cancel').setLabel('إلغاء').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleDeleteConfirm(interaction) {
  await logAction(interaction.guild, {
    title: 'تذكرة محذوفة',
    description: `**القناة:** ${interaction.channel.name}\n**حُذفت بواسطة:** <@${interaction.user.id}>`,
  });
  await interaction.reply({ content: 'جاري حذف القناة...', ephemeral: true });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
}

async function sendRatingEmbed(channel, ticket, admin, source, dmUser = null) {
  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('تقييم الخدمة | OUT TOWN - اوت تاون')
    .setDescription(
      `<@${ticket.opener_id}> شكراً لتواصلك مع فريق اوت تاون\n\n` +
      `**الإداري المسؤول:** <@${admin.id}>\n\n` +
      `قيّم مستوى الخدمة:`
    )
    .setFooter(footer())
    .setTimestamp();

  const buttons = [1, 2, 3, 4, 5].map(n =>
    new ButtonBuilder()
      .setCustomId(`rate_${n}_${ticket.id}_${source}`)
      .setLabel(`${'⭐'.repeat(n)} (${n})`)
      .setStyle(n <= 2 ? ButtonStyle.Danger : n === 3 ? ButtonStyle.Primary : ButtonStyle.Success)
  );

  const rows = [
    new ActionRowBuilder().addComponents(buttons.slice(0, 3)),
    new ActionRowBuilder().addComponents(buttons.slice(3)),
  ];

  if (channel) {
    await channel.send({ content: `<@${ticket.opener_id}>`, embeds: [embed], components: rows });
  }
  if (dmUser) {
    try { await dmUser.send({ embeds: [embed], components: rows }); } catch (_) {}
  }
}

async function handleRating(interaction) {
  const parts    = interaction.customId.split('_');
  const stars    = parseInt(parts[1]);
  const ticketId = parseInt(parts[2]);
  const source   = parts[3];

  const ticket = getTicketById(ticketId);
  if (!ticket) return interaction.reply({ content: 'لم يتم العثور على بيانات التذكرة.', ephemeral: true });

  if (interaction.user.id !== ticket.opener_id) {
    return interaction.reply({ content: 'هذا التقييم لفاتح التذكرة فقط.', ephemeral: true });
  }

  if (db.hasRated(interaction.user.id, ticketId)) {
    return interaction.reply({ content: 'لقد قمت بالتقييم مسبقاً.', ephemeral: true });
  }

  const adminId = ticket.admin_id || ticket.closer_id;
  db.saveRating({ ticketId, channelId: ticket.channel_id, openerId: interaction.user.id, adminId: adminId || 'unknown', stars, source });

  const confirmEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setDescription(`تم استلام تقييمك: ${'⭐'.repeat(stars)} (${stars}/5)\nشكراً جزيلاً!`)
    .setFooter(footer())
    .setTimestamp();

  await interaction.update({ embeds: [confirmEmbed], components: [] });

  const guild          = interaction.guild || interaction.client.guilds.cache.first();
  const ratingChannel  = guild?.channels.cache.get(config.RATING_CHANNEL_ID);

  if (ratingChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor(config.EMBED_COLOR)
      .setTitle('تقييم جديد')
      .setDescription(
        `**المقيّم:** <@${interaction.user.id}>\n` +
        `**الإداري:** <@${adminId || 'unknown'}>\n` +
        `**التذكرة:** <#${ticket.channel_id}>\n` +
        `**التقييم:** ${'⭐'.repeat(stars)} (${stars}/5)\n` +
        `**المصدر:** ${source === 'dm' ? 'رسالة خاصة' : 'داخل التذكرة'}`
      )
      .setFooter(footer())
      .setTimestamp();

    await ratingChannel.send({ embeds: [logEmbed] });
  }
}

async function logAction(guild, { title, description }) {
  const ch = guild.channels.cache.get(config.LOG_CHANNEL_ID);
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle(title)
    .setDescription(description)
    .setFooter(footer())
    .setTimestamp();
  await ch.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  sendTicketPanel,
  openTicket,
  handleManageMenu,
  handleCallUpper,
  handleCallSupport,
  handleLockButton,
  handleLockConfirm,
  handleClaimButton,
  handleDeleteButton,
  handleDeleteConfirm,
  handleRating,
  logAction,
};
