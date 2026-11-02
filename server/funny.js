'use strict';
// Lời đáp hài hước "của người được mời" – càng nhận nhiều ly càng "khổ" vì… uống không xuể 😅
const LINES = {
  trada: [
    [1, 'Ly trà đá mát cả ruột gan, cảm ơn nha! 🧊'],
    [5, '{n} ly trà đá rồi… tối nay chắc khỏi ngủ vì chạy đi vệ sinh 😅'],
    [20, '{n} ly trà đá! Cô Tư ơi cho con mượn cái xô với 🪣'],
    [50, 'Ly thứ {n}… con bắt đầu thấy mình là một cục đá rồi 🧊🧊'],
    [101, '{n} ly trà đá?! Làm sao con uống hết được trời ơi 😅😅😅 Thôi để dành mời lại cả phố!'],
  ],
  tragung: [
    [1, 'Ly trà gừng ấm bụng ấm lòng, cảm ơn bạn 🫚'],
    [5, '{n} ly trà gừng, người con nóng ran như cái bếp than tổ ong 🔥'],
    [20, '{n} ly trà gừng! Giờ con hắt hơi ra cũng thơm mùi gừng 🤧'],
    [50, '{n} ly gừng… mai con mở luôn tiệm mứt gừng Tết được rồi 😂'],
    [101, '{n} ly trà gừng?! Con cay tới mức nói câu nào cũng thành… "gừng càng già càng cay" 😅'],
  ],
  nuocsau: [
    [1, 'Ly nước sấu chua chua mát mát, tỉnh hẳn người! 🍈'],
    [5, '{n} ly nước sấu, mặt con nhăn như quả sấu dầm rồi 😖'],
    [20, '{n} ly sấu! Hà Nội hết mùa sấu là tại con đấy 😅'],
    [50, '{n} ly… răng con ê tới mức nhìn quả chanh cũng sợ 🦷'],
    [101, '{n} ly nước sấu?! Chua thế này thì nỗi buồn nào chịu nổi, chạy hết rồi 😂'],
  ],
  caphe: [
    [1, 'Ly cà phê đen đá, tỉnh táo gỡ rối thôi! ☕'],
    [5, '{n} ly cà phê… tim con đập nhanh hơn deadline rồi đó 💓'],
    [20, '{n} ly cà phê! Giờ con nhìn thấy được cả âm thanh 👀'],
    [50, '{n} ly… con tỉnh tới mức đếm được từng hạt mưa ngoài cửa sổ ☔'],
    [101, '{n} ly cà phê?! Chắc con thức trắng ba ngày làm xong việc cả phòng luôn 😵‍💫'],
  ],
  daunanh: [
    [1, 'Ly sữa đậu nành nóng, thương ghê luôn 🥛'],
    [5, '{n} ly sữa đậu nành, con mềm mại như miếng đậu phụ non rồi 🤍'],
    [20, '{n} ly! Giờ con đi đâu người ta cũng tưởng xe sữa đậu nành đi qua 😂'],
    [50, '{n} ly sữa đậu… chắc con cao thêm được 2 phân 📏'],
    [101, '{n} ly sữa đậu nành?! Đủ làm tào phớ bán cho cả phường rồi 😅😅'],
  ],
  nuocdua: [
    [1, 'Quả dừa mát lạnh, nghỉ chút thôi nào 🥥'],
    [5, '{n} quả dừa, con bắt đầu nói giọng miền Tây rồi nè 🌴'],
    [20, '{n} quả dừa! Sân nhà con giờ thành vườn dừa Bến Tre thu nhỏ 😆'],
    [50, '{n} quả… con lắc đầu nghe óc ách như quả dừa luôn 🥥'],
    [101, '{n} quả dừa?! Con đủ vỏ dừa đóng thuyền thúng chèo ra biển nghỉ dưỡng rồi 😂'],
  ],
  trachanh: [
    [1, 'Ly trà chanh chém gió, ngồi đâu cũng thành hội 🍋'],
    [5, '{n} ly trà chanh, con chém gió bay luôn cái nón lá 🌬️'],
    [20, '{n} ly! Hội trà chanh chém gió đông hơn họp phụ huynh rồi 😆'],
    [50, '{n} ly trà chanh… vỉa hè không đủ ghế nhựa cho khách nữa 🪑'],
    [101, '{n} ly trà chanh?! Gió chém nhiều thế này chắc bão cấp 12 đổ bộ quán Cô Tư 🌪️😂'],
  ],
  nuocmia: [
    [1, 'Ly nước mía ngọt lịm, cảm ơn tấm lòng bạn 🎋'],
    [5, '{n} ly nước mía, đời con ngọt hẳn lên luôn 🍬'],
    [20, '{n} ly! Con ngọt tới mức kiến bu quanh rồi 🐜'],
    [50, '{n} ly nước mía… con đề nghị đổi tên thành "Bé Ngọt" 🍭'],
    [101, '{n} ly nước mía?! Ngọt thế này nha sĩ gọi tên con mất 🦷😅'],
  ],
};

function funnyReply(drink, total) {
  const lines = LINES[drink] || LINES.trada;
  let pick = lines[0];
  for (const l of lines) if (total >= l[0]) pick = l;
  return pick[1].replace('{n}', total);
}

// Câu tổng kết khi nhận nhiều loại nước cùng lúc
function comboReply(totalAll, kinds) {
  if (totalAll >= 101) return `Tổng cộng ${totalAll} ly nước từ ${kinds} món! Con mở quán riêng được rồi, Cô Tư coi chừng mất khách 😂`;
  if (totalAll >= 30) return `${totalAll} ly nước các loại… bụng con giờ là cái quầy giải khát di động 🧃`;
  if (kinds >= 3) return `Trà, cà phê, nước mía đủ cả – mọi người chiều con quá trời 🥹`;
  return '';
}

module.exports = { funnyReply, comboReply };
