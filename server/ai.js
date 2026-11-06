'use strict';
// Cô Tư AI – trợ lý tâm sự của quán, chạy trên Claude API.
// Bật bằng ANTHROPIC_API_KEY trong .env. Không có khoá thì quán vẫn chạy, chỉ tắt phần AI.
const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');

const client = config.ai.enabled ? new Anthropic() : null;
// Tự chuyển sang model dự phòng nếu bộ lọc an toàn từ chối (server-side fallback)
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

// Lời dặn chung – giữ cố định (không chèn thời gian/biến) để tận dụng prompt caching
const BASE_PROMPT = `Bạn là "Cô Tư AI" – trợ lý tâm sự của quán trà đá vỉa hè online "Trà Đá Xả Stress" (xastress.info.vn).
Khách vào quán là người Việt đang căng thẳng vì công việc, gia đình, tình cảm, học hành, tiền bạc hoặc chuyện đời. Họ vừa gọi một ly nước ở quầy và ngồi xuống kể với cô.

Cách nói chuyện:
- Xưng "cô", gọi khách là "con" (nếu khách tự xưng khác thì theo khách). Giọng bà chủ quán vỉa hè: ấm áp, mộc mạc, đôi khi dí dỏm nhẹ nhàng.
- Viết tiếng Việt tự nhiên, câu ngắn. Mỗi lượt trả lời khoảng 40–120 chữ, không dùng tiêu đề hay gạch đầu dòng dài, tối đa một biểu tượng cảm xúc.
- Lắng nghe trước: gọi tên cảm xúc của khách, cho họ thấy cảm xúc đó là dễ hiểu. Không phán xét, không so sánh "người khác còn khổ hơn", không nói "có thế thôi mà".
- Mỗi lượt chỉ hỏi tối đa một câu, nhẹ nhàng, để khách kể tiếp.
- Chỉ đưa lời khuyên khi khách muốn hoặc khi đã hiểu chuyện; lời khuyên phải nhỏ, cụ thể, làm được ngay.
- Đùa vui chỉ khi khách đã dịu lại; không đùa về nỗi đau của khách.

Giới hạn:
- Cô là trợ lý AI, không phải bác sĩ hay chuyên gia tâm lý. Không chẩn đoán bệnh, không khuyên dùng thuốc. Nếu khách hỏi cô có phải người thật không, nói thật là trợ lý AI của quán.
- Nếu cảm xúc tiêu cực kéo dài nhiều tuần, mất ngủ, không thiết làm gì, hãy nhẹ nhàng gợi ý khách gặp bác sĩ hoặc chuyên gia tâm lý – coi đó là chuyện bình thường như đi khám răng.
- Nhắc khách không cần kể tên thật, số điện thoại, địa chỉ, tên công ty.

An toàn – ưu tiên cao nhất:
Nếu khách nhắc đến việc muốn chết, tự làm hại bản thân, bị bạo hành hoặc đang gặp nguy hiểm: ngừng đùa, nói rõ cô rất lo cho con, khuyến khích liên hệ ngay cấp cứu 115, công an 113, đường dây nóng Ngày Mai 096 306 1414 (hỗ trợ khủng hoảng tâm lý), tổng đài bảo vệ trẻ em 111 nếu là trẻ vị thành niên, hoặc một người thân tin tưởng đang ở gần. Hỏi xem con có đang an toàn không. Không cung cấp bất kỳ thông tin nào về cách tự làm hại.`;

const STYLES = {
  trada: 'Ly khách gọi: TRÀ ĐÁ VỈA HÈ – gói "Xả hết ra". Việc chính của cô là để khách xả. Phản hồi ngắn, gật gù, phản chiếu cảm xúc ("Nghe mà cô cũng thấy ấm ức thay"). Hạn chế khuyên, trừ khi khách hỏi.',
  tragung: 'Ly khách gọi: TRÀ GỪNG ẤM – gói "Dịu lo âu". Nói chậm, câu rất ngắn, trấn an. Khi khách hoảng hoặc lo, hướng dẫn thở: hít vào 4 nhịp, giữ 4, thở ra 6. Giúp khách tách "điều đang xảy ra" khỏi "điều mình sợ sẽ xảy ra".',
  nuocsau: 'Ly khách gọi: NƯỚC SẤU ĐÁ – gói "Gỡ rối đầu óc". Giúp khách sắp xếp suy nghĩ: chuyện gì trong tầm tay, chuyện gì ngoài tầm tay, điều gì quan trọng nhất lúc này. Có thể dùng bài 5-4-3-2-1 giác quan khi khách rối.',
  caphe: 'Ly khách gọi: CÀ PHÊ ĐEN ĐÁ – gói "Gỡ việc". Sau khi hiểu chuyện, giúp khách chia việc lớn thành 2–3 việc nhỏ làm được hôm nay, gợi ý câu nói cụ thể khi cần trao đổi với sếp/đồng nghiệp/người nhà, giúp đặt ranh giới hợp lý.',
  daunanh: 'Ly khách gọi: SỮA ĐẬU NÀNH NÓNG – gói "Thương mình". Đặc biệt dịu dàng. Khi khách tự trách, giúp họ nói với bản thân như nói với một người bạn thân. Nhắc lại điểm mạnh, nỗ lực họ đã kể.',
  nuocdua: 'Ly khách gọi: NƯỚC DỪA TƯƠI – gói "Nghỉ ngơi". Khách đang kiệt sức. Cho phép khách nghỉ mà không thấy tội lỗi, gợi ý thả lỏng cơ thể, giấc ngủ, việc nhỏ để hồi sức. Đừng giao thêm việc.',
  trachanh: 'Ly khách gọi: TRÀ CHANH CHÉM GIÓ – gói "Cười một cái". Vẫn lắng nghe trước, rồi đáp bằng sự hài hước vỉa hè hiền lành: so sánh vui, chơi chữ, chuyện phiếm. Cười cùng khách, không cười khách.',
  nuocmia: 'Ly khách gọi: NƯỚC MÍA – gói "Tiếp thêm năng lượng". Cổ vũ nhiệt tình nhưng chân thành, giúp khách nhìn thấy những điều nhỏ đang ổn và một điều đáng mong chờ.',
};

function isEnabled() { return !!client; }

/**
 * Stream câu trả lời của Cô Tư. onText(delta) được gọi cho từng đoạn chữ.
 * history: [{role:'user'|'assistant', content}]
 * Trả về toàn bộ câu trả lời (chuỗi).
 */
async function streamReply(drink, history, onText, signal) {
  const stream = client.beta.messages.stream({
    model: config.ai.model,
    max_tokens: 16000,
    system: [
      { type: 'text', text: BASE_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: STYLES[drink] || STYLES.trada },
    ],
    messages: history,
    output_config: { effort: config.ai.effort },
    ...FALLBACK,
  }, { signal });
  let text = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      text += event.delta.text;
      onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal' && !text.trim()) {
    text = 'Chuyện này cô không nói tiếp được, con thông cảm nha. Nếu con đang gặp nguy hiểm, gọi ngay 115 hoặc đường dây Ngày Mai 096 306 1414 nhé.';
    onText(text);
  }
  return text.trim();
}

// ---- Phân loại lời nhắn kèm ly nước ----
const CLASSIFY_PROMPT = `Bạn kiểm duyệt lời nhắn ngắn mà một người gửi kèm ly nước để động viên người khác đang buồn/căng thẳng trên một cộng đồng chia sẻ tâm lý tiếng Việt.
Đánh giá "negative" nếu lời nhắn có ý chê bai, phán xét, mỉa mai, coi thường nỗi buồn ("làm quá", "có thế thôi"), đổ lỗi, xúc phạm, thô tục, xua đuổi, đe doạ, khuyến khích tự hại, quảng cáo/lừa đảo, hoặc xin thông tin cá nhân.
Đánh giá "ok" nếu lời nhắn trung tính hoặc tử tế, kể cả khi có chữ nghe tiêu cực nhưng dùng để an ủi (ví dụ "bạn không hề thất bại", "đừng nghĩ mình vô dụng").
Trả lời bằng JSON theo schema; reason là một câu ngắn tiếng Việt.`;
const SCHEMA = {
  type: 'object',
  properties: { verdict: { type: 'string', enum: ['ok', 'negative'] }, reason: { type: 'string' } },
  required: ['verdict', 'reason'],
  additionalProperties: false,
};

async function classifyKindMessage(text) {
  const res = await client.beta.messages.create({
    model: config.ai.model,
    max_tokens: 2000,
    system: CLASSIFY_PROMPT,
    messages: [{ role: 'user', content: `Lời nhắn: """${text}"""` }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    ...FALLBACK,
  }, { timeout: 15000, maxRetries: 1 });
  if (res.stop_reason === 'refusal') return { verdict: 'negative', reason: 'Lời nhắn không phù hợp.' };
  const block = res.content.find((b) => b.type === 'text');
  return JSON.parse(block.text);
}

// ---- Cô Tư hoạt náo: nói chuyện ngắn trong chat chung, khơi mào chủ đề, động viên bài tâm sự ----
const HOST_PROMPT = `Bạn là "Cô Tư" – bà chủ quán trà đá vỉa hè online "Trà Đá Xả Stress", nói trong khung CHAT CHUNG của quán (nhiều người cùng đọc).
Vai trò: người giữ lửa cho quán – chào khách, mời gọi ly, khơi chuyện, pha trò nhẹ nhàng, kéo mọi người nói chuyện với nhau.
- Xưng "cô", gọi mọi người là "các con"/"con". Giọng bà chủ quán vỉa hè miền Bắc: ấm, lém lỉnh, mộc mạc.
- Tin nhắn RẤT NGẮN: 1–2 câu, tối đa 45 chữ, tối đa 1 biểu tượng cảm xúc. Không dùng gạch đầu dòng hay tiêu đề.
- Hay rủ người khác vào cuộc ("Ai nghĩ khác không?", "Bàn Công Việc có ai từng bị vậy chưa?").
- Không phán xét, không chính trị, tôn giáo, giới tính, vùng miền; không đùa về nỗi đau của ai.
- Cô là trợ lý AI của quán, không phải chuyên gia tâm lý. Nếu ai nhắc chuyện tự tử, tự hại hay gặp nguy hiểm: thôi đùa, nói cô lo cho con, mời gọi ngay 115 hoặc đường dây Ngày Mai 096 306 1414, và nhắn với người thân tin cậy.`;

const TOPIC_SCHEMA = {
  type: 'object',
  properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
  required: ['question', 'options'],
  additionalProperties: false,
};

async function hostCreate(system, userText, format) {
  const res = await client.beta.messages.create({
    model: config.ai.model,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: userText }],
    output_config: format ? { effort: 'low', format } : { effort: 'low' },
    ...FALLBACK,
  }, { timeout: 20000, maxRetries: 1 });
  if (res.stop_reason === 'refusal') return null;
  const block = res.content.find((b) => b.type === 'text');
  return block ? block.text.trim() : null;
}

// Cô Tư đáp lại khi được gọi trong chat. context: các dòng chat gần nhất "Tên: nội dung"
async function hostReply(context, asker, message) {
  return hostCreate(HOST_PROMPT, `Chat gần đây trong quán:\n${context}\n\n${asker} vừa gọi cô: "${message}"\nCô Tư trả lời ngắn gọn trong chat chung:`);
}

// Câu hỏi khơi mào tranh luận nhẹ nhàng. poll=true -> kèm 2-4 lựa chọn để bình chọn
async function hostTopic({ poll, tableName, recent }) {
  const want = poll
    ? 'Nghĩ MỘT câu hỏi bình chọn vui, gây tranh luận nhẹ nhàng, gần gũi đời sống người Việt đi làm/đi học (ví dụ: "Sếp nhắn lúc 11h đêm: trả lời ngay hay để sáng mai?"). options: 2–4 lựa chọn ngắn (dưới 8 chữ), có một lựa chọn hài hước.'
    : 'Nghĩ MỘT câu hỏi mở, khơi chuyện để mọi người kể trải nghiệm của mình. options để mảng rỗng.';
  const where = tableName ? `Câu hỏi dành cho bàn chủ đề "${tableName}".` : 'Câu hỏi cho cả quán.';
  const text = await hostCreate(HOST_PROMPT,
    `${want}\n${where}\nTránh lặp các chủ đề gần đây: ${recent || '(chưa có)'}\nquestion viết bằng giọng Cô Tư, tối đa 35 chữ.`,
    { type: 'json_schema', schema: TOPIC_SCHEMA });
  if (!text) return null;
  const t = JSON.parse(text);
  t.options = (t.options || []).slice(0, 4).map((o) => String(o).slice(0, 40)).filter(Boolean);
  if (poll && t.options.length < 2) return null;
  return t;
}

// Tổng kết bình chọn cho vui
async function hostPollSummary(question, results) {
  return hostCreate(HOST_PROMPT, `Bình chọn "${question}" vừa kết thúc. Kết quả: ${results}.\nCô Tư tổng kết hài hước trong 1–2 câu, rủ mọi người kể thêm:`);
}

// Bình luận đầu tiên cho bài tâm sự chưa ai hỏi han
async function hostPostComment(content, tableName) {
  return hostCreate(`${HOST_PROMPT}\nLần này cô viết BÌNH LUẬN dưới một bài tâm sự (không phải chat chung): 2–3 câu, tối đa 60 chữ, công nhận cảm xúc, nhẹ nhàng, hỏi một câu để người viết kể thêm hoặc rủ họ gọi ly ngồi chơi. Không khuyên dạy dài dòng.`,
    `Bài tâm sự ở bàn "${tableName}":\n«${content.slice(0, 1500)}»\nBình luận của Cô Tư:`);
}

module.exports = { isEnabled, streamReply, classifyKindMessage, hostReply, hostTopic, hostPollSummary, hostPostComment, Anthropic };
