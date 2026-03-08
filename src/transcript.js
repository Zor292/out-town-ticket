const { AttachmentBuilder } = require('discord.js');

async function generateTranscript(channel, ticket, guild) {
  const messages = [];
  let lastId;

  while (true) {
    const opts = { limit: 100 };
    if (lastId) opts.before = lastId;
    const batch = await channel.messages.fetch(opts);
    if (batch.size === 0) break;
    messages.push(...batch.values());
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }

  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const profiles = {};
  for (const msg of messages) {
    if (!profiles[msg.author.id]) {
      const member = guild.members.cache.get(msg.author.id);
      profiles[msg.author.id] = {
        author: msg.author.username,
        avatar: msg.author.displayAvatarURL({ size: 64, extension: 'webp' }),
        roleColor: member?.displayHexColor || '#ffffff',
        roleName: member?.roles.highest.name || '',
        bot: msg.author.bot,
        verified: msg.author.bot,
      };
    }
  }

  const profilesJson = JSON.stringify(profiles);

  let messagesHtml = '';
  for (const msg of messages) {
    messagesHtml += renderMessage(msg);
  }

  const openerMember = guild.members.cache.get(ticket.opener_id);
  const openerName   = openerMember?.user.username || ticket.opener_id;
  const adminName    = ticket.admin_id ? (guild.members.cache.get(ticket.admin_id)?.user.username || ticket.admin_id) : 'غير محدد';
  const serverIcon   = guild.iconURL({ size: 128, extension: 'webp' }) || '';
  const guildName    = guild.name;

  const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${channel.name}</title>
<script>
document.addEventListener("click",t=>{
  const e=t.target;if(!e)return;
  const o=e?.getAttribute("data-goto");
  if(o){const r=document.getElementById("m-"+o);
    if(r){r.scrollIntoView({behavior:"smooth",block:"center"});
    r.style.backgroundColor="rgba(148,156,247,0.1)";
    r.style.transition="background-color 0.5s ease";
    setTimeout(()=>{r.style.backgroundColor="transparent"},1000);}
  }
});
</script>
<script>window.$discordMessage={profiles:${profilesJson}}</script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@derockdev/discord-components-core@^3.6.1/dist/derockdev-discord-components-core/derockdev-discord-components-core.esm.js"></script>
</head>
<body style="margin:0;min-height:100vh">
<discord-messages style="min-height:100vh">
<discord-header guild="${escHtml(guildName)}" channel="${escHtml(channel.name)}" icon="${escHtml(serverIcon)}">
  Ticket Owner: ${ticket.opener_id} | Claim: ${ticket.admin_id || 'none'}
</discord-header>
${messagesHtml}
<div style="text-align:center;width:100%;padding:16px;color:#72767d;font-size:13px">
  تم تصدير ${messages.length} رسالة — OUT TOWN - اوت تاون | Developed by firas
</div>
</discord-messages>
</body>
</html>`;

  const buffer = Buffer.from(html, 'utf-8');
  return new AttachmentBuilder(buffer, { name: `${channel.name}.html` });
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMessage(msg) {
  const ts        = msg.createdAt.toISOString();
  const edited    = msg.editedAt ? 'true' : 'false';
  const profileId = msg.author.id;

  let inner = '';

  // reply
  if (msg.reference?.messageId && msg.mentions.repliedUser) {
    const refAuthor = msg.mentions.repliedUser;
    inner += `<discord-reply slot="reply" edited="false" attachment="false"
      author="${escHtml(refAuthor.username)}"
      avatar="${escHtml(refAuthor.displayAvatarURL({ size: 32, extension: 'webp' }))}"
      bot="${refAuthor.bot}"
      verified="false" op="false" command="false">
      <span data-goto="${msg.reference.messageId}">${escHtml(msg.cleanContent?.slice(0,80) || '')}</span>
    </discord-reply>`;
  }

  // text content
  if (msg.content) {
    inner += escHtml(msg.content);
  }

  // embeds
  for (const embed of msg.embeds) {
    const color = embed.hexColor || '#FF0000';
    let embedHtml = `<discord-embed slot="embeds" color="${escHtml(color)}"`;
    if (embed.title) embedHtml += ` embed-title="${escHtml(embed.title)}"`;
    if (embed.url)   embedHtml += ` url="${escHtml(embed.url)}"`;
    if (embed.image?.url)     embedHtml += ` image="${escHtml(embed.image.url)}"`;
    if (embed.thumbnail?.url) embedHtml += ` thumbnail="${escHtml(embed.thumbnail.url)}"`;
    embedHtml += '>';

    if (embed.author?.name) {
      embedHtml += `<discord-embed-author slot="author"`;
      if (embed.author.iconURL) embedHtml += ` icon-url="${escHtml(embed.author.iconURL)}"`;
      embedHtml += `>${escHtml(embed.author.name)}</discord-embed-author>`;
    }

    if (embed.description) {
      embedHtml += `<discord-embed-description slot="description">${escHtml(embed.description)}</discord-embed-description>`;
    }

    for (const field of (embed.fields || [])) {
      embedHtml += `<discord-embed-field slot="fields" field-title="${escHtml(field.name)}"${field.inline ? ' inline="true"' : ''}>${escHtml(field.value)}</discord-embed-field>`;
    }

    if (embed.footer?.text) {
      embedHtml += `<discord-embed-footer slot="footer"`;
      if (embed.footer.iconURL) embedHtml += ` footer-image="${escHtml(embed.footer.iconURL)}"`;
      if (embed.timestamp)      embedHtml += ` timestamp="${new Date(embed.timestamp).toISOString()}"`;
      embedHtml += `>${escHtml(embed.footer.text)}</discord-embed-footer>`;
    }

    embedHtml += `</discord-embed>`;
    inner += embedHtml;
  }

  // attachments
  for (const att of msg.attachments.values()) {
    if (att.contentType?.startsWith('image/')) {
      inner += `<discord-attachment slot="attachments" url="${escHtml(att.url)}" alt="${escHtml(att.name)}" width="${att.width||400}" height="${att.height||300}"></discord-attachment>`;
    }
  }

  return `<discord-message id="m-${msg.id}" timestamp="${ts}" edited="${edited}" highlight="false" profile="${profileId}">
  ${inner}
</discord-message>\n`;
}

module.exports = { generateTranscript };
