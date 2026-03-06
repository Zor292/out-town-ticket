// ============================================================
//   OUT TOWN - اوت تاون | Bot Configuration
// ============================================================

module.exports = {
  // ── Server Info ──────────────────────────────────────────
  SERVER_NAME: 'OUT TOWN - اوت تاون',
  SERVER_ICON: 'https://cdn.discordapp.com/attachments/1479253716854112296/1479258301056286721/Snapchat-470668691.jpg?ex=69ab6226&is=69aa10a6&hm=7d5bd8fc037cf7862465ac2703d9f88c9f01fc502ded46d07c91ecd4d5c8c329&animated=true',

  // ── Embed Color ──────────────────────────────────────────
  EMBED_COLOR: 0xFF0000, // Red / أحمر

  // ── Ticket Category ──────────────────────────────────────
  TICKET_CATEGORY_ID: '1364328756906426551',

  // ── Ticket Support Roles (per type) ──────────────────────
  // Only admins with these roles can claim / see tickets
  TICKET_ROLES: {
    support:     '1456836224366149738', // الدعم فني
    inspection:  '1456836224366149738', // الرقابة والتفتيش
    rank:        '1456836224366149738', // طلب رتبة
    report:      '1456836224366149738', // شكوى أو ابلاغ
    partnership: '1456836224366149738', // شراكة أو اعلان
  },

  // ── Channels ─────────────────────────────────────────────
  LOG_CHANNEL_ID:    '1460322675108085962', // قناة اللوقات
  RATING_CHANNEL_ID: '1460322675108085962', // قناة التقييمات

  // ── Ticket Types ─────────────────────────────────────────
  TICKET_TYPES: [
    {
      id: 'support',
      label: '🔧 الدعم الفني',
      description: 'للمشاكل التقنية والاستفسارات',
      emoji: '🔧',
    },
    {
      id: 'inspection',
      label: '🔍 الرقابة والتفتيش',
      description: 'للإبلاغ عن المخالفات',
      emoji: '🔍',
    },
    {
      id: 'rank',
      label: '🎖️ طلب رتبة',
      description: 'لطلب رتبة أو ترقية',
      emoji: '🎖️',
    },
    {
      id: 'report',
      label: '📢 شكوى أو ابلاغ',
      description: 'لتقديم شكوى أو ابلاغ',
      emoji: '📢',
    },
    {
      id: 'partnership',
      label: '🤝 شراكة أو اعلان',
      description: 'للشراكات والإعلانات',
      emoji: '🤝',
    },
  ],

  // ── Footer ───────────────────────────────────────────────
  FOOTER_TEXT: 'OUT TOWN - اوت تاون',
  FOOTER_ICON: 'https://cdn.discordapp.com/attachments/1479253716854112296/1479258301056286721/Snapchat-470668691.jpg?ex=69ab6226&is=69aa10a6&hm=7d5bd8fc037cf7862465ac2703d9f88c9f01fc502ded46d07c91ecd4d5c8c329&animated=true',

  // ── Rating ───────────────────────────────────────────────
  RATING_STARS: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'],
};
