// ============================================================
//   OUT TOWN - اوت تاون | Ticket Manager
// ============================================================

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} = require('discord.js');

const config  = require('./config');
const db      = require('./database');

// ─────────────────────────────────────────────────────────────
//  Helper – build the standard embed footer
// ─────────────────────────────────────────────────────────────
function footer() {
  return { text: config.FOOTER_TEXT, iconURL: config.FOOTER_ICON };
}

// ─────────────────────────────────────────────────────────────
//  Send the ticket-panel embed (used by /panel command)
// ─────────────────────────────────────────────────────────────
async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('🎫 نظام التذاكر | OUT TOWN - اوت تاون')
    .setDescription(
      '> مرحباً بك في نظام الدعم الخاص بسيرفر **OUT TOWN - اوت تاون**\n\n' +
      '📌 **اختر نوع التذكرة من القائمة أدناه وسيتم فتح قناة خاصة بك مع فريق الدعم.**\n\n' +
      '🔧 **الدعم الفني** — للمشاكل التقنية والاستفسارات\n' +
      '🔍 **الرقابة والتفتيش** — للإبلاغ عن المخالفات\n' +
      '🎖️ **طلب رتبة** — لطلب رتبة أو ترقية\n' +
      '📢 **شكوى أو ابلاغ** — لتقديم شكوى أو ابلاغ\n' +
      '🤝 **شراكة أو اعلان** — للشراكات والإعلانات'
    )
    .setThumbnail(config.SERVER_ICON)
    .setImage(config.SERVER_ICON)
    .setFooter(footer())
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_type_select')
    .setPlaceholder('📂 اختر نوع التذكرة...')
    .addOptions(
      config.TICKET_TYPES.map(t => ({
        label: t.label,
        description: t.description,
        value: t.id,
        emoji: t.emoji,
      }))
    );

  const row = new ActionRowBuilder().addComponents(menu);
  await channel.send({ embeds: [embed], components: [row] });
}

// ─────────────────────────────────────────────────────────────
//  Open a new ticket channel
// ─────────────────────────────────────────────────────────────
async function openTicket(interaction, ticketType) {
  const guild  = interaction.guild;
  const opener = interaction.user;
  const type   = config.TICKET_TYPES.find(t => t.id === ticketType);

  if (!type) {
    return interaction.reply({ content: '❌ نوع التذكرة غير معروف.', ephemeral: true });
  }

  // Check if user already has an open ticket of this type
  const existing = guild.channels.cache.find(
    c => c.name.startsWith(`${type.emoji}-`) && c.topic && c.topic.includes(opener.id)
  );
  if (existing) {
    return interaction.reply({
      content: `❌ لديك تذكرة مفتوحة بالفعل: <#${existing.id}>`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketNum = db.getNextTicketNumber(guild.id);
  const channelName = `${type.emoji}-${ticketType}-${ticketNum}`;

  // Permission overwrites
  const permissionOverwrites = [
    // deny everyone
    {
      id: guild.roles.everyone,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    // allow the opener
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
    // allow the specific admin role for this ticket type
    {
      id: config.TICKET_ROLES[ticketType] || config.TICKET_ROLES.support,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.TICKET_CATEGORY_ID,
    topic: `تذكرة بواسطة ${opener.id} | النوع: ${type.label} | #${ticketNum}`,
    permissionOverwrites,
  });

  const ticketId = db.createTicket({
    channelId: ticketChannel.id,
    guildId: guild.id,
    openerId: opener.id,
    type: ticketType,
  });

  // ── Welcome embed inside ticket ──────────────────────────
  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle(`${type.emoji} تذكرة جديدة — ${type.label}`)
    .setDescription(
      `> مرحباً <@${opener.id}> 👋\n\n` +
      `📌 **نوع التذكرة:** ${type.label}\n` +
      `🔢 **رقم التذكرة:** \`#${ticketNum}\`\n\n` +
      `يُرجى شرح مشكلتك بالتفصيل وسيقوم أحد أعضاء الفريق بالرد عليك في أقرب وقت ممكن.`
    )
    .setThumbnail(config.SERVER_ICON)
    .setFooter(footer())
    .setTimestamp();

  // ── Action buttons ───────────────────────────────────────
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_lock')
      .setLabel('🔒 قفل التذكرة')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('✋ استلام التذكرة')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket_delete')
      .setLabel('🗑️ حذف التذكرة')
      .setStyle(ButtonStyle.Secondary),
  );

  await ticketChannel.send({
    content: `<@${opener.id}> | <@&${config.TICKET_ROLES[ticketType] || config.TICKET_ROLES.support}>`,
    embeds: [embed],
    components: [row],
  });

  // Log
  await logAction(guild, {
    title: '🎫 تذكرة جديدة',
    description: `**فاتح التذكرة:** <@${opener.id}>\n**النوع:** ${type.label}\n**القناة:** <#${ticketChannel.id}>\n**الرقم:** #${ticketNum}`,
    color: config.EMBED_COLOR,
  });

  await interaction.editReply({
    content: `✅ تم فتح تذكرتك: <#${ticketChannel.id}>`,
  });
}

// ─────────────────────────────────────────────────────────────
//  Lock ticket — confirm → send rating
// ─────────────────────────────────────────────────────────────
async function handleLockButton(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: '❌ لم يتم العثور على بيانات التذكرة.', ephemeral: true });

  // Check if user has admin role for this ticket
  const adminRoleId = config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support;
  if (!interaction.member.roles.cache.has(adminRoleId) && ticket.opener_id !== interaction.user.id) {
    return interaction.reply({ content: '❌ ليس لديك صلاحية لقفل هذه التذكرة.', ephemeral: true });
  }

  // Confirmation embed
  const confirmEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('🔒 تأكيد قفل التذكرة')
    .setDescription('هل أنت متأكد من رغبتك في **قفل** هذه التذكرة؟\nسيتم إرسال طلب تقييم للعميل.')
    .setFooter(footer())
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_lock_confirm')
      .setLabel('✅ تأكيد القفل')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_lock_cancel')
      .setLabel('❌ إلغاء')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: false });
}

async function handleLockConfirm(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: '❌ لم يتم العثور على بيانات التذكرة.', ephemeral: true });

  // Close in DB
  db.closeTicket({ channelId: interaction.channel.id, closerId: interaction.user.id });

  // Remove send permissions from opener, keep read-only
  await interaction.channel.permissionOverwrites.edit(ticket.opener_id, {
    SendMessages: false,
  });

  const closedEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('🔒 تم قفل التذكرة')
    .setDescription(
      `تم قفل هذه التذكرة بواسطة <@${interaction.user.id}>\n\n` +
      `سيتم إرسال نموذج التقييم إلى <@${ticket.opener_id}> الآن.`
    )
    .setFooter(footer())
    .setTimestamp();

  await interaction.update({ embeds: [closedEmbed], components: [] });

  // ── Send rating embed in ticket ──────────────────────────
  await sendRatingEmbed(interaction.channel, ticket, interaction.user, 'ticket');

  // ── Send rating embed via DM ─────────────────────────────
  try {
    const opener = await interaction.client.users.fetch(ticket.opener_id);
    await sendRatingEmbed(null, ticket, interaction.user, 'dm', opener);
  } catch (_) {
    // DMs might be disabled
  }

  // Log
  await logAction(interaction.guild, {
    title: '🔒 تذكرة مقفلة',
    description: `**القناة:** <#${interaction.channel.id}>\n**أُغلقت بواسطة:** <@${interaction.user.id}>\n**فاتح التذكرة:** <@${ticket.opener_id}>`,
    color: config.EMBED_COLOR,
  });
}

// ─────────────────────────────────────────────────────────────
//  Claim ticket
// ─────────────────────────────────────────────────────────────
async function handleClaimButton(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: '❌ لم يتم العثور على بيانات التذكرة.', ephemeral: true });

  const adminRoleId = config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support;
  if (!interaction.member.roles.cache.has(adminRoleId)) {
    return interaction.reply({ content: '❌ ليس لديك صلاحية لاستلام هذه التذكرة.', ephemeral: true });
  }

  db.setTicketAdmin(interaction.channel.id, interaction.user.id);

  const claimEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('✋ تم استلام التذكرة')
    .setDescription(`تم استلام هذه التذكرة من قِبل <@${interaction.user.id}>`)
    .setFooter(footer())
    .setTimestamp();

  await interaction.reply({ embeds: [claimEmbed] });

  await logAction(interaction.guild, {
    title: '✋ استلام تذكرة',
    description: `**القناة:** <#${interaction.channel.id}>\n**المستلم:** <@${interaction.user.id}>`,
    color: config.EMBED_COLOR,
  });
}

// ─────────────────────────────────────────────────────────────
//  Delete ticket
// ─────────────────────────────────────────────────────────────
async function handleDeleteButton(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: '❌ لم يتم العثور على بيانات التذكرة.', ephemeral: true });

  const adminRoleId = config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support;
  if (!interaction.member.roles.cache.has(adminRoleId)) {
    return interaction.reply({ content: '❌ ليس لديك صلاحية لحذف هذه التذكرة.', ephemeral: true });
  }

  const confirmEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('🗑️ تأكيد حذف التذكرة')
    .setDescription('هل أنت متأكد من رغبتك في **حذف** هذه التذكرة؟ لا يمكن التراجع عن هذا الإجراء.')
    .setFooter(footer())
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_delete_confirm')
      .setLabel('🗑️ تأكيد الحذف')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_delete_cancel')
      .setLabel('❌ إلغاء')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [confirmEmbed], components: [row] });
}

async function handleDeleteConfirm(interaction) {
  await interaction.reply({ content: '🗑️ جاري حذف القناة...', ephemeral: true });

  await logAction(interaction.guild, {
    title: '🗑️ تذكرة محذوفة',
    description: `**القناة:** ${interaction.channel.name}\n**حُذفت بواسطة:** <@${interaction.user.id}>`,
    color: config.EMBED_COLOR,
  });

  setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
}

// ─────────────────────────────────────────────────────────────
//  Rating System
// ─────────────────────────────────────────────────────────────
async function sendRatingEmbed(channel, ticket, admin, source, dmUser = null) {
  const updatedTicket = db.getTicketByChannel(ticket.channel_id);
  const adminUser = admin;

  const ratingEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('⭐ تقييم الخدمة | OUT TOWN - اوت تاون')
    .setDescription(
      `<@${ticket.opener_id}> — شكراً لتواصلك مع فريق **OUT TOWN - اوت تاون**!\n\n` +
      `📋 **التذكرة:** <#${ticket.channel_id}>\n` +
      `👤 **الإداري المسؤول:** <@${adminUser.id}>\n\n` +
      `⭐ يُرجى تقييم مستوى الخدمة التي تلقيتها بالضغط على عدد النجوم:`
    )
    .setThumbnail(config.SERVER_ICON)
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
    // Send in ticket channel — mention opener
    await channel.send({
      content: `<@${ticket.opener_id}>`,
      embeds: [ratingEmbed],
      components: rows,
    });
  }

  if (dmUser) {
    try {
      await dmUser.send({ embeds: [ratingEmbed], components: rows });
    } catch (_) {}
  }
}

async function handleRating(interaction) {
  // custom id: rate_{stars}_{ticketId}_{source}
  const parts  = interaction.customId.split('_');
  const stars  = parseInt(parts[1]);
  const ticketId = parseInt(parts[2]);
  const source = parts[3]; // 'ticket' or 'dm'

  // Find the ticket
  const allTickets = db.getTicketByChannel(interaction.channel?.id || '');
  // We need to find by ticketId — let's add a helper
  const ticket = getTicketById(ticketId);

  if (!ticket) {
    return interaction.reply({ content: '❌ لم يتم العثور على بيانات التذكرة.', ephemeral: true });
  }

  // Check opener
  if (interaction.user.id !== ticket.opener_id) {
    return interaction.reply({ content: '❌ هذا التقييم مخصص لفاتح التذكرة فقط.', ephemeral: true });
  }

  // Check if already rated
  if (db.hasRated(interaction.user.id, ticketId)) {
    return interaction.reply({ content: '❌ لقد قمت بالتقييم مسبقاً. يمكنك التقييم مرة واحدة فقط.', ephemeral: true });
  }

  // Save rating
  const adminId = ticket.admin_id || ticket.closer_id;
  db.saveRating({
    ticketId,
    channelId: ticket.channel_id,
    openerId: interaction.user.id,
    adminId: adminId || 'unknown',
    stars,
    source,
  });

  // Confirmation
  const confirmEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('✅ شكراً على تقييمك!')
    .setDescription(
      `تقييمك: ${'⭐'.repeat(stars)} **(${stars}/5)**\n\n` +
      `شكراً جزيلاً على تقييمك! سيساعدنا ذلك في تحسين الخدمة.`
    )
    .setFooter(footer())
    .setTimestamp();

  await interaction.update({ embeds: [confirmEmbed], components: [] });

  // Send to rating channel
  const ratingChannel = interaction.guild
    ? interaction.guild.channels.cache.get(config.RATING_CHANNEL_ID)
    : await interaction.client.guilds.cache
        .map(g => g.channels.cache.get(config.RATING_CHANNEL_ID))
        .find(Boolean);

  if (ratingChannel) {
    const ratingLogEmbed = new EmbedBuilder()
      .setColor(config.EMBED_COLOR)
      .setTitle('📊 تقييم جديد | OUT TOWN - اوت تاون')
      .setDescription(
        `**المقيِّم:** <@${interaction.user.id}>\n` +
        `**الإداري:** <@${adminId || 'unknown'}>\n` +
        `**التذكرة:** <#${ticket.channel_id}>\n` +
        `**التقييم:** ${'⭐'.repeat(stars)} **(${stars}/5)**\n` +
        `**المصدر:** ${source === 'dm' ? '📩 رسالة خاصة' : '💬 داخل التذكرة'}`
      )
      .setFooter(footer())
      .setTimestamp();

    await ratingChannel.send({ embeds: [ratingLogEmbed] });
  }
}

// ─────────────────────────────────────────────────────────────
//  Log helper
// ─────────────────────────────────────────────────────────────
async function logAction(guild, { title, description, color }) {
  const logChannel = guild.channels.cache.get(config.LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(color || config.EMBED_COLOR)
    .setTitle(title)
    .setDescription(description)
    .setFooter(footer())
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
//  Extra DB helper (get ticket by ID)
// ─────────────────────────────────────────────────────────────
const Database = require('better-sqlite3');
const path = require('path');
const _db = new Database(path.join(__dirname, '..', 'outtown.db'));

function getTicketById(id) {
  return _db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
}

module.exports = {
  sendTicketPanel,
  openTicket,
  handleLockButton,
  handleLockConfirm,
  handleClaimButton,
  handleDeleteButton,
  handleDeleteConfirm,
  handleRating,
  logAction,
};
