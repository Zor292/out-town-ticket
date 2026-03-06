// ============================================================
//   OUT TOWN - اوت تاون | Main Entry Point
// ============================================================

require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const config        = require('./config');
const tm            = require('./ticketManager');
const commands      = require('./commands');
const db            = require('./database');

// ── Discord Client ────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ── Ready ─────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ تم تشغيل البوت: ${client.user.tag}`);
  console.log(`📡 السيرفر: OUT TOWN - اوت تاون`);

  client.user.setActivity('OUT TOWN - اوت تاون 🎫', { type: 3 });

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ تم تسجيل الأوامر بنجاح');
  } catch (err) {
    console.error('❌ خطأ في تسجيل الأوامر:', err);
  }
});

// ── Interactions ──────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  try {

    // ── Select Menu: ticket type ────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_select') {
      await tm.openTicket(interaction, interaction.values[0]);
      return;
    }

    // ── Buttons ─────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === 'ticket_lock')          return tm.handleLockButton(interaction);
      if (id === 'ticket_lock_confirm')  return tm.handleLockConfirm(interaction);
      if (id === 'ticket_lock_cancel')   return interaction.update({ content: '❌ تم إلغاء القفل.', components: [], embeds: [] });
      if (id === 'ticket_claim')         return tm.handleClaimButton(interaction);
      if (id === 'ticket_delete')        return tm.handleDeleteButton(interaction);
      if (id === 'ticket_delete_confirm') return tm.handleDeleteConfirm(interaction);
      if (id === 'ticket_delete_cancel') return interaction.update({ content: '❌ تم إلغاء الحذف.', components: [], embeds: [] });
      if (id.startsWith('rate_'))        return tm.handleRating(interaction);
    }

    // ── Slash Commands ───────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;

    // /panel
    if (interaction.commandName === 'panel') {
      await interaction.deferReply({ ephemeral: true });
      await tm.sendTicketPanel(interaction.channel);
      await interaction.editReply({ content: '✅ تم إرسال لوحة التذاكر.' });
      return;
    }

    // /close
    if (interaction.commandName === 'close') {
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: '❌ هذه القناة ليست تذكرة.', ephemeral: true });

      const adminRoleId = config.TICKET_ROLES[ticket.type] || config.TICKET_ROLES.support;
      if (!interaction.member.roles.cache.has(adminRoleId)) {
        return interaction.reply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
      }

      await tm.handleLockButton(interaction);
      return;
    }

    // /add
    if (interaction.commandName === 'add') {
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: '❌ هذه القناة ليست تذكرة.', ephemeral: true });

      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setDescription(`✅ تم إضافة <@${user.id}> إلى التذكرة.`)
        .setFooter({ text: config.FOOTER_TEXT, iconURL: config.FOOTER_ICON });

      return interaction.reply({ embeds: [embed] });
    }

    // /remove
    if (interaction.commandName === 'remove') {
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: '❌ هذه القناة ليست تذكرة.', ephemeral: true });

      const user = interaction.options.getUser('user');
      if (user.id === ticket.opener_id) {
        return interaction.reply({ content: '❌ لا يمكن إزالة فاتح التذكرة.', ephemeral: true });
      }

      await interaction.channel.permissionOverwrites.delete(user.id);

      const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setDescription(`✅ تم إزالة <@${user.id}> من التذكرة.`)
        .setFooter({ text: config.FOOTER_TEXT, iconURL: config.FOOTER_ICON });

      return interaction.reply({ embeds: [embed] });
    }

    // /stats
    if (interaction.commandName === 'stats') {
      // Simple stats from DB
      const { getNextTicketNumber } = require('./database');
      // Count tickets
      const Database = require('better-sqlite3');
      const path = require('path');
      const _db = new Database(path.join(__dirname, '..', 'outtown.db'));

      const total   = _db.prepare('SELECT COUNT(*) as c FROM tickets').get().c;
      const open    = _db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='open'").get().c;
      const closed  = _db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='closed'").get().c;
      const avgRate = _db.prepare('SELECT AVG(stars) as a FROM ratings').get().a;

      const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setTitle('📊 إحصائيات التذاكر | OUT TOWN - اوت تاون')
        .setDescription(
          `📁 **إجمالي التذاكر:** ${total}\n` +
          `🟢 **مفتوحة:** ${open}\n` +
          `🔒 **مغلقة:** ${closed}\n` +
          `⭐ **متوسط التقييم:** ${avgRate ? avgRate.toFixed(1) : 'لا يوجد'}/5`
        )
        .setFooter({ text: config.FOOTER_TEXT, iconURL: config.FOOTER_ICON })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

  } catch (err) {
    console.error('❌ خطأ في التفاعل:', err);
    const msg = { content: '❌ حدث خطأ غير متوقع. يُرجى المحاولة مرة أخرى.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(msg).catch(() => {});
    } else {
      interaction.reply(msg).catch(() => {});
    }
  }
});

// ── Login ─────────────────────────────────────────────────────
client.login(process.env.TOKEN);
