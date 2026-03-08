require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  EmbedBuilder,
  ActivityType,
} = require('discord.js');

const config   = require('./config');
const tm       = require('./ticketManager');
const commands = require('./commands');
const db       = require('./database');

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

client.once('ready', async () => {
  console.log(`Bot online: ${client.user.tag}`);

  client.user.setActivity('Dev : firas', { type: ActivityType.Watching });

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Commands registered.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.on('interactionCreate', async interaction => {
  try {

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_type_select') {
        return tm.openTicket(interaction, interaction.values[0]);
      }
      if (interaction.customId === 'ticket_manage_menu') {
        return tm.handleManageMenu(interaction);
      }
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'ticket_call_upper')     return tm.handleCallUpper(interaction);
      if (id === 'ticket_call_support')   return tm.handleCallSupport(interaction);
      if (id === 'ticket_lock')           return tm.handleLockButton(interaction);
      if (id === 'ticket_lock_confirm')   return tm.handleLockConfirm(interaction);
      if (id === 'ticket_lock_cancel')    return interaction.update({ content: 'تم الإلغاء.', components: [], embeds: [] });
      if (id === 'ticket_claim')          return tm.handleClaimButton(interaction);
      if (id === 'ticket_delete')         return tm.handleDeleteButton(interaction);
      if (id === 'ticket_delete_confirm') return tm.handleDeleteConfirm(interaction);
      if (id === 'ticket_delete_cancel')  return interaction.update({ content: 'تم الإلغاء.', components: [], embeds: [] });
      if (id.startsWith('rate_'))         return tm.handleRating(interaction);
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'panel') {
      await interaction.deferReply({ ephemeral: true });
      await tm.sendTicketPanel(interaction.channel);
      await interaction.editReply({ content: 'تم إرسال لوحة التذاكر.' });
      return;
    }

    if (interaction.commandName === 'close') {
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: 'هذه القناة ليست تذكرة.', ephemeral: true });
      return tm.handleLockButton(interaction);
    }

    if (interaction.commandName === 'add') {
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: 'هذه القناة ليست تذكرة.', ephemeral: true });
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      });
      return interaction.reply({ content: `تم إضافة <@${user.id}>.` });
    }

    if (interaction.commandName === 'remove') {
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: 'هذه القناة ليست تذكرة.', ephemeral: true });
      const user = interaction.options.getUser('user');
      if (user.id === ticket.opener_id) return interaction.reply({ content: 'لا يمكن إزالة فاتح التذكرة.', ephemeral: true });
      await interaction.channel.permissionOverwrites.delete(user.id);
      return interaction.reply({ content: `تم إزالة <@${user.id}>.` });
    }

    if (interaction.commandName === 'stats') {
      const Database = require('better-sqlite3');
      const path     = require('path');
      const sdb      = new Database(path.join(__dirname, '..', 'outtown.db'));

      const total   = sdb.prepare('SELECT COUNT(*) as c FROM tickets').get().c;
      const open    = sdb.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='open'").get().c;
      const closed  = sdb.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='closed'").get().c;
      const avgRate = sdb.prepare('SELECT AVG(stars) as a FROM ratings').get().a;

      const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setTitle('احصائيات التذاكر')
        .setDescription(
          `**اجمالي التذاكر:** ${total}\n` +
          `**مفتوحة:** ${open}\n` +
          `**مغلقة:** ${closed}\n` +
          `**متوسط التقييم:** ${avgRate ? avgRate.toFixed(1) : 'لا يوجد'}/5`
        )
        .setFooter({ text: config.FOOTER_TEXT, iconURL: config.FOOTER_ICON })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

  } catch (err) {
    console.error('Interaction error:', err);
    const msg = { content: 'حدث خطأ غير متوقع.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(msg).catch(() => {});
    } else {
      interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
