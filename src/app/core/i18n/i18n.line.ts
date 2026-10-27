import { registerPack } from './i18n.service';

// Lazy dictionary pack "line": the strings of the LINE Official Account customer-chat channel (the chat roster page,
// link sets of chats, the import dialog and, later, the schedule options, the editor's {{name}} help and the chat
// wording of posts). Only the lazily loaded LINE components import this module, which registers the pack (see
// registerPack in i18n.service.ts), so it stays out of the first bundle. Every file that reads t().api.line must
// `import '<path>/core/i18n/i18n.line'`. The sidebar label and the route title are NOT here: the title strategy
// resolves them with no pack loaded, so they sit in i18n.extra.ts (`lineChatNav`).
//
// How to add a leaf: append `name: ['ไทย', 'English'],` (a [th, en] pair, both languages) below, then read it as
// t().api.line.name; fill {placeholders} with fmt(). Keys start with `chat` or `lineChat`: "LINE" alone already
// means the notification channel (`ntf.line`), which is a different feature. Customers' MESSAGE TEXT does not exist
// anywhere in this app, so no string here may promise to show it.
export const AP_I18N_LINE = {
  // The three hints every pack repeats (see i18n.service.spec.ts): the pack files are edited by different pages.
  storedOnly: [
    'บันทึกไว้เท่านั้น ยังไม่มีส่วนใดนำค่านี้ไปใช้',
    'Saved only: nothing applies this setting yet',
  ],
  storedOnlyBadge: ['บันทึกเท่านั้น', 'Saved only'],
  planLocked: ['ใช้ได้ในแผน {plan} ขึ้นไป', 'Available on {plan} and above'],

  // ---- The roster page (/app/line-chats) ------------------------------------------------------------------------
  chatTitle: ['แชทลูกค้า LINE', 'LINE customer chats'],
  chatSub: [
    'รายชื่อลูกค้าที่เคยคุยกับ LINE Official Account ของร้าน ส่วนขยายอ่านรายชื่อจากหน้า “รายชื่อติดต่อ” ของ LINE Official Account Manager ในเครื่องของคุณ ครั้งเดียวตอนเชื่อมต่อ แล้วซิงก์ให้เองวันละครั้ง ระบบเก็บแค่ชื่อ ป้ายกำกับ และวันที่คุยล่าสุด ไม่เก็บข้อความของลูกค้า',
    'The customers who have chatted with the shop’s LINE Official Account. The extension reads the list from the “Contacts” page of LINE Official Account Manager in your own browser, once when you connect and then once a day. Only the name, labels and date of the last chat are kept, never what a customer wrote',
  ],
  chatLockedTitle: [
    'แชท LINE ใช้ได้ในแพ็กเกจ {plan} ขึ้นไป',
    'LINE chats are available on {plan} and above',
  ],
  chatLockedBody: [
    'แพ็กเกจของเจ้าของเวิร์กสเปซนี้ยังไม่รวมการส่งแชทหาลูกค้า LINE อัปเกรดแพ็กเกจเพื่อดูรายชื่อแชทและสร้างชุดลิงก์แชท',
    'This workspace owner’s plan does not include sending to LINE customers. Upgrade to see the chat list and build chat link sets',
  ],
  chatLoading: ['กำลังอ่านรายชื่อแชท…', 'Reading the chat list…'],
  chatLoadFailed: ['อ่านรายชื่อแชทไม่สำเร็จ', 'The chat list could not be read'],
  chatRetry: ['ลองอีกครั้ง', 'Try again'],

  // The browsers that drive a LINE Official Account.
  chatStatusTitle: [
    'LINE Official Account ของแต่ละเครื่อง',
    'LINE Official Account of each browser',
  ],
  chatStateReady: ['พร้อมส่ง', 'Ready'],
  chatStateLogin: ['รอล็อกอิน LINE OA', 'Waiting for LINE OA login'],
  chatStateResting: ['พักชั่วคราว', 'Resting'],
  chatStateLoginHint: [
    'เปิด chat.line.biz ใน Chrome ของเครื่องนั้นแล้วล็อกอิน LINE Official Account Manager ระบบจะส่งต่ออัตโนมัติเมื่อล็อกอินแล้ว',
    'Open chat.line.biz in that machine’s Chrome and sign in to LINE Official Account Manager. Sending goes on by itself once it is signed in',
  ],
  chatStateRestingHint: [
    'ระบบพักบัญชี LINE นี้ไว้จนถึง {time} เพราะส่งไม่สำเร็จหลายครั้งติดกัน Facebook ของเครื่องนี้ยังโพสต์ตามปกติ',
    'This LINE account is resting until {time} because several sends failed in a row. Facebook posting on this machine goes on as usual',
  ],
  chatDeviceOffline: ['เครื่องนี้ออฟไลน์', 'This machine is offline'],
  chatCount: ['{n} แชท', '{n} chats'],
  chatSynced: ['ซิงก์ล่าสุด {when}', 'Last synced {when}'],
  chatNeverSynced: ['ยังไม่เคยซิงก์รายชื่อ', 'Chat list not synced yet'],
  chatSyncNow: ['ซิงก์รายชื่อแชทตอนนี้', 'Sync the chat list now'],
  chatSyncSent: [
    'สั่งให้ {name} ซิงก์รายชื่อแชทแล้ว รายชื่อจะอัปเดตเมื่อเครื่องอ่านเสร็จ',
    'Told {name} to sync the chat list. It updates when the machine has read it',
  ],
  chatSyncNeedsLogin: [
    'ซิงก์ไม่ได้จนกว่าจะล็อกอิน LINE OA ในเครื่องนั้น',
    'Cannot sync until LINE OA is signed in on that machine',
  ],
  chatNoLineTitle: ['ยังไม่มีเครื่องที่เชื่อม LINE OA', 'No machine is connected to a LINE OA yet'],
  // Schedule builder: where the schedule posts, and the LINE chat options.
  schTarget: ['ส่งไปที่', 'Posts to'],
  schTargetFb: ['Facebook · กลุ่มและเพจ', 'Facebook · groups and pages'],
  schTargetLine: [
    'LINE · แชทลูกค้า (ข้อความหาลูกค้าที่เคยแชทกับ LINE OA)',
    'LINE · customer chats (messages to customers who chatted with the LINE OA)',
  ],
  schTargetNone: [
    'เลือกชุดลิงก์ก่อน แล้วจะรู้ว่าตารางนี้ส่งไป Facebook หรือ LINE',
    'Pick a link set first: it decides whether this schedule goes to Facebook or LINE',
  ],
  schLineHint: [
    'ตารางนี้ส่งข้อความหาลูกค้าทีละแชทผ่านเครื่องที่ล็อกอิน LINE OA ในช่วงเวลาที่กำหนด ใส่ชื่อลูกค้าในข้อความได้ด้วยแท็กชื่อ ตั้งค่าเหล่านี้ตอนสร้างแล้วเปลี่ยนไม่ได้',
    'This schedule sends to customers one chat at a time from the machine signed in to the LINE OA, inside the hours below. The customer’s name can go into the text with the name tag. These are fixed when the schedule is created',
  ],
  schLineFrom: ['ส่งได้ตั้งแต่', 'Send from'],
  schLineTo: ['ถึง', 'until'],
  schLineSkip: ['ถ้าลูกค้าเพิ่งตอบ ให้รอ (นาที)', 'If the customer wrote recently, wait (minutes)'],
  schLineSplit: ['แยกข้อความยาวเป็นหลายบับเบิล', 'Split a long text into several bubbles'],
  schLineImagesFirst: ['ส่งรูปก่อนข้อความ', 'Send the images before the text'],
  schBadHours: [
    'ช่วงเวลาส่งของ LINE ไม่ถูกต้อง (ใช้รูปแบบ 09:00)',
    'The LINE sending hours are not valid (use a form like 09:00)',
  ],
  chatChange: ['เปลี่ยน LINE OA', 'Change LINE OA'],
  chatChangeTitle: ['เปลี่ยน LINE OA ของเครื่องนี้', 'Change this machine’s LINE OA'],
  chatChangeBody: [
    'ระบบจะเลิกผูก LINE OA “{oa}” กับเครื่อง {name}: รายชื่อแชทของ OA นี้ที่ซิงก์ไว้จะถูกลบ งานส่งแชทที่ค้างอยู่จะล้มเหลว (Facebook ไม่ถูกแตะ) แล้วเชื่อม LINE OA ใหม่ตามลิงก์ที่วาง และอ่านรายชื่อลูกค้าของ OA ใหม่',
    'This unlinks the LINE OA “{oa}” from {name}: the synced chat list of this OA is deleted and unfinished chat sends fail (Facebook is untouched). Then the OA from the pasted link is connected and its customer list is read',
  ],
  chatChangeDone: [
    '{name}: เลิกผูก LINE OA แล้ว เปิดหน้าสถานะของส่วนขยายเพื่อเชื่อม LINE OA ใหม่',
    '{name}: LINE OA unlinked. Open the extension’s status page to connect a new one',
  ],
  // The "connect a LINE OA" card: paste the OA's address, the browser reads the customers once, then daily.
  chatLinkTitle: ['เชื่อมต่อ LINE OA', 'Connect a LINE OA'],
  chatLinkHelp: [
    'เปิด LINE Official Account Manager ใน Chrome ที่ล็อกอินไว้ คัดลอกลิงก์ของ OA (เช่น https://chat.line.biz/Uxxxxxxxx/) มาวางที่นี่ ระบบจะอ่านรายชื่อลูกค้าจากหน้ารายชื่อติดต่อครั้งเดียว แล้วซิงก์ซ้ำให้เองวันละครั้ง',
    'Open LINE Official Account Manager in the signed-in Chrome, copy the OA’s address (for example https://chat.line.biz/Uxxxxxxxx/) and paste it here. The customer list is read once from the contacts page and then synced again by itself once a day',
  ],
  chatLinkLabel: ['ลิงก์ LINE OA', 'LINE OA link'],
  chatLinkPh: ['https://chat.line.biz/Uxxxxxxxx/', 'https://chat.line.biz/Uxxxxxxxx/'],
  chatLinkBtn: ['เชื่อมต่อและดึงรายชื่อลูกค้า', 'Connect and read the customers'],
  chatLinkBad: [
    'ลิงก์ไม่ถูกต้อง วางลิงก์จาก chat.line.biz เช่น https://chat.line.biz/Uxxxxxxxx/',
    'Not a valid link. Paste an address from chat.line.biz, for example https://chat.line.biz/Uxxxxxxxx/',
  ],
  chatLinkDevice: ['เครื่องที่ใช้', 'Machine'],
  chatLinkSent: [
    'สั่ง {name} แล้ว: กำลังเชื่อม LINE OA และอ่านรายชื่อลูกค้า รายชื่อจะขึ้นที่นี่ภายในไม่กี่นาที (ถ้าส่วนขยายยังไม่ได้รับอนุญาตให้ใช้ chat.line.biz หน้าสถานะจะเปิดขึ้นในเครื่องนั้นให้กดอนุญาต)',
    'Sent to {name}: it is connecting the LINE OA and reading the customers. They appear here within a few minutes (if the extension is not yet allowed to use chat.line.biz, its status page opens on that machine to allow it)',
  ],
  chatDailyNote: [
    'ส่วนขยายซิงก์รายชื่อลูกค้าให้เองวันละครั้ง (กด “ซิงก์รายชื่อแชทตอนนี้” เมื่ออยากให้อัปเดตทันที)',
    'The extension syncs the customer list by itself once a day (press “Sync the chat list now” to update at once)',
  ],
  chatConnect: ['เชื่อมต่อ LINE OA', 'Connect LINE OA'],
  chatConnectSent: [
    'สั่ง {name} แล้ว: เปิดหน้าสถานะของส่วนขยายในเครื่องนั้น กด “ใช้ LINE OA ในเครื่องนี้” ต่อได้เลย',
    'Sent to {name}: its extension status page opens there. Press “Use LINE OA on this machine”',
  ],
  chatConnectOffline: ['เครื่องนี้ออฟไลน์อยู่', 'This machine is offline'],
  chatConnectTitle: ['เครื่องที่ยังไม่ได้เชื่อม LINE OA', 'Machines not connected to a LINE OA'],
  chatNoLineBody: [
    'จับคู่ส่วนขยายในเครื่องที่ล็อกอิน LINE Official Account Manager ไว้ที่หน้าทีมก่อน แล้วกลับมาวางลิงก์ LINE OA ที่หน้านี้',
    'Pair the extension on the machine that is signed in to LINE Official Account Manager (Team page) first, then come back and paste the LINE OA link here',
  ],

  // Filters.
  chatSearch: ['ค้นหาลูกค้า', 'Search customers'],
  chatSearchPh: ['พิมพ์ชื่อลูกค้า', 'Type a customer’s name'],
  chatAccount: ['LINE OA', 'LINE OA'],
  chatAccountAll: ['ทุกบัญชี', 'All accounts'],
  chatLabelFilter: ['ป้ายกำกับ', 'Label'],
  chatLabelAll: ['ทุกป้ายกำกับ', 'All labels'],
  chatRecent: ['คุยล่าสุดภายใน', 'Last chat within'],
  chatRecentAny: ['ทุกช่วงเวลา', 'Any time'],
  chatRecentDays: ['{n} วัน', '{n} days'],
  chatDnsFilter: ['สถานะห้ามส่ง', 'Do-not-send mark'],
  chatDnsAll: ['ทั้งหมด', 'All'],
  chatDnsOnly: ['เฉพาะที่ห้ามส่ง', 'Only marked'],
  chatDnsExcept: ['ไม่รวมที่ห้ามส่ง', 'Not marked'],
  chatClearFilters: ['ล้างตัวกรอง', 'Clear filters'],
  chatShown: ['พบ {n} แชท', '{n} chats found'],

  // Rows.
  chatLastAt: ['คุยล่าสุด {when}', 'Last chat {when}'],
  chatLastUnknown: ['ยังไม่ทราบเวลาที่คุยล่าสุด', 'Time of the last chat unknown'],
  chatUnread: ['ลูกค้าส่งข้อความมาที่ยังไม่ได้อ่าน', 'The customer wrote something not read yet'],
  chatInSets: ['อยู่ใน {n} ชุดลิงก์', 'In {n} link sets'],
  chatInNoSet: ['ยังไม่อยู่ในชุดลิงก์', 'Not in a link set yet'],
  chatDoNotSend: ['ห้ามส่ง', 'Do not send'],
  chatDoNotSendAria: ['ห้ามส่งข้อความหา {name}', 'Do not send to {name}'],
  chatDoNotSendHint: [
    'ติ๊กแล้วระบบจะไม่ส่งหาลูกค้าคนนี้อีก ไม่ว่าจะอยู่ในชุดลิงก์ไหน และคงอยู่แม้ซิงก์รายชื่อใหม่',
    'When ticked nothing is sent to this customer, whatever link set they are in, and the mark stays through the next sync',
  ],
  chatDnsOn: ['ตั้ง {name} เป็นห้ามส่งแล้ว', '{name} is marked do-not-send'],
  chatDnsOff: ['เอา {name} ออกจากรายการห้ามส่งแล้ว', '{name} is no longer marked do-not-send'],
  chatCustomer: ['ลูกค้า', 'Customer'],

  // Empty states.
  chatEmptyTitle: ['ยังไม่มีรายชื่อแชท', 'No chats yet'],
  chatEmptyBody: [
    'รายชื่อจะขึ้นเมื่อเครื่องที่เชื่อม LINE OA ซิงก์เสร็จ กด “ซิงก์รายชื่อแชทตอนนี้” ด้านบนได้เลย ถ้าเครื่องพร้อมแล้ว',
    'The list fills once a machine connected to a LINE OA has synced. Press “Sync the chat list now” above when the machine is ready',
  ],
  chatNoMatch: ['ไม่พบแชทที่ตรงกับตัวกรอง', 'No chat matches the filters'],

  // ---- Link sets of chats (/app/targets) ------------------------------------------------------------------------
  chatChannel: ['ส่งไปที่', 'Send to'],
  chatChannelFb: ['กลุ่ม Facebook', 'Facebook groups'],
  chatChannelLine: ['แชท LINE', 'LINE chats'],
  chatChannelLineLocked: [
    'แชท LINE ใช้ได้ในแพ็กเกจ {plan} ขึ้นไป',
    'LINE chats are available on {plan} and above',
  ],
  chatChannelLineNoAccount: [
    'ยังไม่มีเครื่องที่เชื่อม LINE OA: เปิดหน้าสถานะของส่วนขยายแล้วกด “ใช้ LINE OA ในเครื่องนี้” ก่อน',
    'No machine is connected to a LINE OA yet: open the extension’s status page and press “Use LINE OA on this machine” first',
  ],
  chatNewSetExt: ['เครื่องที่ส่งแชทชุดนี้ (LINE OA)', 'Machine that sends this chat set (LINE OA)'],
  chatBadge: ['แชท LINE', 'LINE chats'],
  chatFilterAll: ['ทุกประเภท', 'All kinds'],
  chatFilterLabel: ['แสดงชุดลิงก์', 'Show link sets'],
  chatManualNote: [
    'ชุดแชท LINE: ตอนส่งระบบจะกด “แชทแบบแมนนวล” ในแชทของลูกค้า ซึ่งอาจหยุดบอทตอบอัตโนมัติของแชทนั้นชั่วคราว',
    'LINE chat sets: to send, the extension presses “Manual chat” in the customer’s chat, which may pause the auto-reply bot for that chat for a while',
  ],
  chatSetMeta: ['{n} แชท · เปิดใช้ {m}', '{n} chats · {m} on'],
  chatImport: ['นำเข้าจากแชท LINE', 'Import from LINE chats'],
  chatSetEmpty: [
    'ชุดนี้ยังไม่มีแชท กด “นำเข้าจากแชท LINE” เพื่อเลือกลูกค้าจากรายชื่อที่ซิงก์ไว้',
    'This set has no chats yet. Press “Import from LINE chats” to pick customers from the synced list',
  ],
  chatPostAsHint: [
    'เลือกเครื่องที่ส่งแชทชุดนี้ เลือกได้เฉพาะเครื่องที่เชื่อม LINE OA แล้ว เครื่องนี้ส่งหาลูกค้าทุกคนในชุด',
    'Choose the machine that sends this chat set. Only machines connected to a LINE OA can be chosen; it sends to every customer in the set',
  ],
  chatLoginNeeded: [
    'LINE ยังไม่ล็อกอินในเครื่องนี้: เปิด chat.line.biz ใน Chrome ของเครื่องนั้นแล้วล็อกอิน ชุดนี้จะรอจนกว่าจะล็อกอิน',
    'LINE is not signed in on this machine: open chat.line.biz in its Chrome and sign in. This set waits until then',
  ],
  chatRulesTitle: ['กติกาของแชทในชุดนี้', 'Rules for the chats of this set'],
  chatRandomOrder: [
    'สุ่มลำดับลูกค้าทุกรอบ ไม่เริ่มจากคนแรกเสมอ',
    'Random customer order every round, not always the first customer first',
  ],
  chatRandomOrderHint: [
    'แต่ละรอบจะเรียงลูกค้าใหม่แบบสุ่ม ปิดไว้ถ้าอยากส่งตามลำดับในรายการ',
    'Every round puts the customers in a new random order. Turn it off to send in the order of the list',
  ],
  chatDailyPerCustomer: ['ส่งได้สูงสุดต่อลูกค้า', 'Most messages per customer'],
  chatDailyPerCustomerUnit: ['ข้อความ/วัน', 'a day'],
  chatDailyPerCustomerHint: [
    '1 = ลูกค้าแต่ละคนได้รับแค่หนึ่งครั้งต่อวัน (ค่าเริ่มต้นของชุดแชท) 0 = ไม่จำกัด ยกเว้นลูกค้าที่ตั้ง “สูงสุด/วัน” ของตัวเองไว้',
    '1 = each customer gets one message a day (the default for chat sets). 0 = no limit, except customers with their own “Max/day”',
  ],
  chatNamePh: ['ชื่อลูกค้า', 'Customer name'],
  chatKind: ['แชท', 'Chat'],
  chatKindHint: ['แชทของลูกค้า LINE', 'A LINE customer chat'],
  chatInvalidUrl: [
    'ไม่ใช่ลิงก์แชทของ LINE Official Account Manager (chat.line.biz/…/chat/…)',
    'Not a LINE Official Account Manager chat link (chat.line.biz/…/chat/…)',
  ],
  chatExample: [
    'ตัวอย่างข้อความที่ลูกค้า “{name}” จะได้รับ',
    'Example of what customer “{name}” would get',
  ],
  chatExampleBody: [
    'สวัสดีคุณ {{name}} วันนี้มีโปรโมชั่นพิเศษสำหรับคุณ',
    'Hello {{name}}, today there is a special offer for you',
  ],
  chatOwnSetsChats: ['{s} ชุด · {c} แชท', '{s} sets · {c} chats'],
  chatOwnLineOf: ['{name} · LINE', '{name} · LINE'],
  chatOverlapTitle: [
    'มี {n} แชทอยู่ในชุดของหลายเครื่อง',
    '{n} chats sit in the sets of more than one machine',
  ],
  chatOverlapKeeps: [
    'แชทนี้อยู่ในชุดของเครื่องอื่นด้วย เครื่องนี้เป็นผู้ส่ง เครื่องอื่นจะข้าม',
    'This chat is in another machine’s set too. This machine sends it; the other skips it',
  ],
  chatOverlapSkipped: [
    'ซ้ำกับชุด “{set}” ของเครื่อง “{ext}” เครื่องนี้จะไม่ส่งแชทนี้',
    'Also in set “{set}” of machine “{ext}”. This machine will not send this chat',
  ],

  // ---- The import dialog ----------------------------------------------------------------------------------------
  chatImportTitle: ['นำเข้าจากแชท LINE', 'Import from LINE chats'],
  chatImportHint: [
    'เลือกลูกค้าจากรายชื่อที่เครื่องซิงก์ไว้ (เฉพาะ LINE OA ของเครื่องที่ส่งชุดนี้) ลูกค้าที่ตั้งห้ามส่งไว้เลือกไม่ได้',
    'Pick customers from the list the machine synced (only the LINE OA of the machine that sends this set). Customers marked do-not-send cannot be picked',
  ],
  chatImportNoOwner: [
    'ชุดนี้ยังไม่ได้เลือกเครื่องที่ส่ง เลือกเครื่องในการ์ดของชุดก่อนนำเข้าแชท',
    'This set has no machine yet. Choose one on the set’s card before importing chats',
  ],
  chatImportInSet: ['อยู่ในชุดนี้แล้ว', 'Already in this set'],
  chatImportAll: [
    'เลือกทั้งหมดที่ตรงกับตัวกรอง ({n} แชท)',
    'Pick everything that matches the filters ({n} chats)',
  ],
  chatImportAllHint: [
    'จะนำเข้าทุกแชทที่ตรงกับคำค้น ป้ายกำกับ และช่วงเวลาที่กรองไว้ ไม่ใช่แค่หน้านี้ แชทที่ห้ามส่งหรืออยู่ในชุดนี้แล้วจะถูกข้าม',
    'Imports every chat that matches the search, label and time filters, not just this page. Chats marked do-not-send or already in the set are skipped',
  ],
  chatImportGo: ['เพิ่ม {n} แชท', 'Add {n} chats'],
  chatImportGoAll: ['เพิ่มทุกแชทที่ตรงกับตัวกรอง', 'Add every chat that matches'],
  chatImportDone: [
    'เพิ่มแล้ว {n} แชท ข้าม {d} ที่ซ้ำ {s} ที่ห้ามส่ง',
    'Added {n} chats; skipped {d} repeated and {s} marked do-not-send',
  ],
  chatImportConflicts: [
    'ข้าม {n} แชทที่อยู่ในชุดของเครื่องอื่นแล้ว: {note}',
    'Left out {n} chats another machine already has: {note}',
  ],
  chatImportFailed: ['นำเข้าแชทไม่สำเร็จ', 'The chats could not be imported'],

  // ---- The LINE OA master list (/app/line-oas) ---------------------------------------------------------------------
  oaTitle: ['LINE OA (ข้อมูลหลัก)', 'LINE OA master list'],
  oaSub: [
    'รายการ LINE Official Account ของร้านทั้งหมด วางลิงก์ chat.line.biz ของแต่ละ OA ส่วนขยายจะเปิด OA นั้นแล้วอ่านลิงก์แชทของลูกค้าแต่ละคนมาเก็บไว้ แยกตาม OA ชุดโพสต์ฝั่ง LINE เลือก OA จากรายการนี้ได้เลย (ฝั่ง Facebook ใช้หน้า “ชุดลิงก์” เหมือนเดิม)',
    'Every LINE Official Account of the shop. Paste the chat.line.biz link of each OA: the extension opens that OA and reads each customer’s chat link, kept apart per OA. LINE link sets pick their OA from this list (Facebook still uses the “Link sets” page)',
  ],
  oaUrlLabel: ['ลิงก์ LINE OA', 'LINE OA link'],
  oaUrlPh: ['https://chat.line.biz/Uxxxxxxxxxxxx', 'https://chat.line.biz/Uxxxxxxxxxxxx'],
  oaDeviceLabel: ['เครื่องที่อ่านรายชื่อลูกค้า', 'Machine that reads the customers'],
  oaDevicePick: ['เลือกเครื่อง', 'Pick a machine'],
  oaDeviceErr: ['เลือกเครื่องที่จะอ่านรายชื่อ', 'Pick the machine that reads the list'],
  oaUrlErr: ['วางลิงก์ที่ขึ้นต้นด้วย chat.line.biz', 'Paste a link that starts with chat.line.biz'],
  oaAdd: ['เพิ่ม LINE OA', 'Add LINE OA'],
  oaAdded: [
    'เพิ่ม {name} แล้ว กำลังสั่งให้ส่วนขยายอ่านรายชื่อลูกค้า (ต้องล็อกอิน LINE OA Manager ในเครื่องนั้นไว้)',
    'Added {name}. The extension is told to read its customers (LINE OA Manager must be signed in on that machine)',
  ],
  oaNoDevice: [
    'ยังไม่มีส่วนขยายที่เชื่อมไว้ เชื่อมส่วนขยายที่หน้า “ทีม” ก่อน แล้วค่อยเพิ่ม LINE OA',
    'No extension is connected yet. Connect one on the “Team” page, then add a LINE OA',
  ],
  oaEmptyTitle: ['ยังไม่มี LINE OA ในรายการ', 'No LINE OA in the list yet'],
  oaEmptyBody: [
    'วางลิงก์ chat.line.biz ของ OA ด้านบน แล้วระบบจะดึงลิงก์แชทของลูกค้ามาให้',
    'Paste the chat.line.biz link of an OA above and its customers’ chat links are fetched',
  ],
  oaLoading: ['กำลังอ่านรายการ LINE OA…', 'Reading the LINE OA list…'],
  oaLoadFailed: ['อ่านรายการ LINE OA ไม่สำเร็จ', 'The LINE OA list could not be read'],
  oaOpenOa: ['เปิด LINE OA', 'Open LINE OA'],
  oaMachine: ['เครื่อง: {name}', 'Machine: {name}'],
  oaMachineOffline: ['เครื่อง: {name} (ออฟไลน์)', 'Machine: {name} (offline)'],
  oaReady: ['พร้อม', 'Ready'],
  oaWaiting: ['รอเครื่องอ่านรายชื่อ', 'Waiting for the machine to read'],
  oaSessionLost: ['ต้องล็อกอิน LINE OA ใหม่', 'LINE OA needs signing in again'],
  oaCustomers: ['ลูกค้า {n} คน', '{n} customers'],
  oaSets: ['ใช้ใน {n} ชุดโพสต์', 'Used by {n} link sets'],
  oaNoSets: ['ยังไม่มีชุดโพสต์ใช้', 'No link set uses it'],
  oaSync: ['อ่านรายชื่อใหม่', 'Read again'],
  oaSyncSent: [
    'สั่งให้เครื่องอ่านรายชื่อของ {name} แล้ว รายชื่อจะอัปเดตเมื่ออ่านเสร็จ',
    'Told the machine to read {name}. The list updates when it is done',
  ],
  oaSyncFailed: ['สั่งอ่านรายชื่อไม่สำเร็จ', 'Could not start the reading'],
  oaRemove: ['ลบ', 'Remove'],
  oaRemoveTitle: ['ลบ LINE OA นี้?', 'Remove this LINE OA?'],
  oaRemoveBody: [
    'ลบ {name} ออกจากรายการ รายชื่อลูกค้าของ OA นี้จะถูกลบด้วย (ลบไม่ได้ถ้ามีชุดโพสต์ใช้อยู่)',
    'Removes {name} from the list together with its customers (not possible while a link set uses it)',
  ],
  oaRemoved: ['ลบ {name} แล้ว', 'Removed {name}'],
  oaShowCustomers: ['ดูลูกค้า', 'Show customers'],
  oaHideCustomers: ['ซ่อนลูกค้า', 'Hide customers'],
  oaOpenChat: ['เปิดแชท', 'Open chat'],
  oaNoCustomers: [
    'ยังไม่มีรายชื่อลูกค้าของ OA นี้ กด “อ่านรายชื่อใหม่” หรือรอให้เครื่องอ่านเสร็จ',
    'No customers read for this OA yet. Press “Read again” or wait for the machine to finish',
  ],
  // The link-set dialog: the OA is picked from the master list.
  oaPickLabel: [
    'LINE OA ที่จะส่งแชท (จากรายการ LINE OA)',
    'LINE OA to send through (from the LINE OA list)',
  ],
  oaPickPh: ['เลือก LINE OA', 'Pick a LINE OA'],
  oaPickErr: ['เลือก LINE OA ที่จะส่ง', 'Pick the LINE OA to send through'],
  oaPickNone: [
    'ยังไม่มี LINE OA ในรายการ: เพิ่มที่หน้า “LINE OA” ก่อน',
    'No LINE OA in the list yet: add one on the “LINE OA” page first',
  ],
  oaPickManage: ['จัดการรายการ LINE OA', 'Manage the LINE OA list'],
} as const;

registerPack('line', AP_I18N_LINE);
