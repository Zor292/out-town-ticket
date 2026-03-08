// ============================================================
//   OUT TOWN - اوت تاون | Slash Commands
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('إرسال لوحة التذاكر | OUT TOWN - اوت تاون')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('قفل التذكرة الحالية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('إضافة مستخدم إلى التذكرة')
    .addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('إزالة مستخدم من التذكرة')
    .addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('إحصائيات التذاكر')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
];

module.exports = commands;
