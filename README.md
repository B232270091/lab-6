# Лаборатори 6 Category Partition ба PICT

**Оюутан:** Ган-Оргил  
**Код:** B232270091  
**Хичээл:** F.CSA313 Программ хангамжийн чанарын баталгаа ба тест

Энэ ажил нь `POST /transfer` функцийн тодорхойлолтод тулгуурласан тест дизайн юм. Category-partition аргаар сонголт, төлөөлөх утга, хязгаарлалт, oracle боловсруулж, Microsoft PICT-ийн 2-way ба 3-way гаралттай харьцуулна. Шилжүүлгийн програм байхгүй учраас доорх HTTP үр дүн нь **хүлээгдэх үр дүн** бөгөөд API ажиллуулж хэмжсэн үр дүн биш.

## A1 Сонголтууд ба төлөөлөх утгууд

### Данс болон орчны нөхцөл

Тест бүр тусдаа, цэвэр fixture ашиглана. `A100` нь MNT валюттай, 1000 MNT үлдэгдэлтэй эх данс; `A200` нь түүнээс өөр, оршин байгаа MNT данс; `F100` нь A100-тай ижил үзүүлэлттэй боловч царцаагдсан данс. `X404` болон `Y404` дансууд байхгүй. Өдрийн нийт лимит 2000 MNT. `DailyUsage=Fresh` үед өнөөдөр ашигласан дүн 0, үлдсэн лимит R=2000 MNT; `Used` үед ашигласан дүн 1500, R=500 MNT байна. Тестүүдийн хооронд үлдэгдэл, өдрийн хэрэглээг дахин тохируулна.

`Currency=Same` үед хүсэлтийн валют MNT, `Different` үед USD байна. **Зөвхөн тестийн тогтмол ханш** 1 USD = 2 MNT гэж авсан; энэ нь зах зээлийн бодит ханш биш. Доорх `d` нь хөрвүүлсний дараах MNT дүн. Оролтын `amount` нь MNT үед d, USD үед d/2 байна. Жишээлбэл USD 500.5 → MNT 1001; тоонуудыг аравтын нарийвчлалтай гэж үзнэ. Валютын код буруу байх, ханш олдохгүй байх, бутархайг тоймлох дүрэм тодорхойлолтод байхгүй тул эдгээрт шинэ ERROR зохиогоогүй.

| Ангилал | Сонголт | Төлөөлөх утга буюу setup | Тэмдэглэгээ ба үндэслэл |
|---|---|---|---|
| from | Valid | A100, оршин байгаа, frozen=false | `[property source_exists, source_active]` — ердийн шилжүүлэгт шаардлагатай. |
| from | Frozen | F100, frozen=true | `[ERROR] [property source_exists]` — оршин байгаа боловч царцаатай данс ERROR_FROZEN өдөөдөг. |
| from | Missing | X404, үүсгэхгүй | `[ERROR]` — ERROR_NO_FROM өдөөдөг. |
| to | Valid | A200 | `[property target_exists, distinct]` — эх данснаас өөр, хүчинтэй хүлээн авагч. |
| to | Missing | Y404, үүсгэхгүй | `[ERROR]` — ERROR_NO_TO өдөөдөг. |
| to | SameAsFrom | to=from | `[ERROR] [IF source_exists]` — ERROR_SAME_ACCOUNT-ийг байхгүй дансны алдаанаас салгаж шалгана. |
| amount | Normal | d=100; MNT 100 эсвэл USD 50 | `[property positive, affordable, within_limit]` — хоёр орчинд хоёуланд зөвшөөрөгдөнө. |
| amount | Zero | d=0 | `[ERROR]` — 0 гэсэн зааг дээр ERROR_BAD_AMOUNT гарна. |
| amount | Negative | d=-1; USD үед -0.5 | `[ERROR]` — сөрөг дүнгийн ангид ERROR_BAD_AMOUNT гарна. |
| amount | OverBalance | d=1001; USD үед 500.5 | `[ERROR] [IF Fresh]` — үлдэгдлээс 1-ээр их боловч R=2000 лимит дотор байж ERROR_INSUFFICIENT-ийг тусгаарлана. |
| amount | OverLimit | d=R+1; Used үед 501, Fresh үед 2001 | `[ERROR] [IF Used]` — Used орчинд үлдэгдэл хүрэлцэх боловч лимитээс 1-ээр их тул ERROR_LIMIT-ийг тусгаарлана. |
| amount | ExactLimit | d=R; сонгосон SINGLE setup-д 500 | `[SINGLE]` — үлдсэн лимиттэй яг тэнцүү дүнг нэг зориуд сонгосон зөв нөхцөлөөр шалгана. |
| currency | Same | MNT, amount=d | `[property same_currency]` — ханшийн хөрвүүлэлт шаардахгүй. |
| currency | Different | USD, amount=d/2 | `[property conversion_required]` — хөрвүүлсний дараа үлдэгдэл, лимит шалгана. |
| далд орчин DailyUsage | Fresh | used=0, R=2000 MNT | `[property fresh]` — өдрийн хэрэглээ байхгүй төлөв. |
| далд орчин DailyUsage | Used | used=1500, R=500 MNT | `[property partially_used]` — өмнөх шилжүүлгүүдээс үлдсэн лимитийг тооцно. |

Эдгээр нь хязгааргүй тоон мужийн бүх утга биш, сонгосон төлөөлөх утгуудын загвар юм. Бодит системийн нэмэлт заагийн тестэд үлдэгдэлтэй яг тэнцүү дүн, хамгийн бага мөнгөн нэгж, лимит бүрэн дууссан төлөвийг нэмж болно.

### Алдааны давуу эрэмбэ

**NO_FROM → FROZEN → NO_TO → SAME_ACCOUNT → BAD_AMOUNT → INSUFFICIENT → LIMIT** гэж сонгосон: эхлээд эх дансыг ашиглаж болох эсэх, дараа нь хүлээн авагч, эцэст нь мөнгөн дүнг шалгах нь хэрэгжүүлэхэд тодорхой, давтагдах oracle өгнө. Энэ эрэмбэ нь өгөгдсөн тодорхойлолтын дутуу хэсгийг нөхсөн **тест дизайны таамаглал**; системийн эзэмшигчээр баталгаажуулах шаардлагатай. Амжилт нь `201 {"result":"OK"}`, бүх оролтын алдаа нь `200 {"result":"ERROR_..."}` байна.

## A2 Хязгаарлалтууд ба тооцоо

| Хязгаарлалт | Тайлбар |
|---|---|
| `To=SameAsFrom ⇒ From≠Missing` | `[IF source_exists]`: ижил дансны тусгай тестэд эх данс оршин байх ёстой; from/to хоёулаа нэг байхгүй ID байх тохиолдлыг энэ constrained загварт зориуд сонгохгүй. Frozen эх данс оршин байдаг учраас энэ хослолыг үлдээнэ. |
| `Amount=OverBalance ⇒ DailyUsage=Fresh` | `[IF Fresh]`: 1001 нь үлдэгдлээс их, 2000 лимитээс бага; ганц дүнгийн алдааг шалгана. |
| `Amount=OverLimit ⇒ DailyUsage=Used` | `[IF Used]`: 501 нь 500 лимитээс их, 1000 үлдэгдлээс бага; ганц дүнгийн алдааг шалгана. |
| `Amount=ExactLimit ⇒ From=Valid, To=Valid, Currency=Same, DailyUsage=Used` | `[SINGLE]`: яг R=500 нөхцөлийг нэг л бүтэн frame болгон хадгална. |
| `[ERROR]` сонголтуудыг тусгаарлах | Category-partition-ийн сөрөг frame-д нэг ERROR сонголт авна; PICT-ийн энгийн нэршил энэ дүрмийг автоматаар хэрэгжүүлэхгүй тул `transfer-neg.model` файлд `~` тэмдэглэнэ. |

Бүрэн сонголтын олонлог: **N = 3 × 3 × 6 × 2 × 2 = 216**. Энэ нь бүх сонгосон түвшний үржвэр болохоос PICT-ийн мөрийн тоо биш.

Эхний IF-ийн дараа From×To-ийн 9 хосоос Missing+SameAsFrom хасагдаж 8 үлдэнэ. Normal, Zero, Negative тус бүр 8×2×2=32; OverBalance, OverLimit тус бүр 8×2×1=16; ExactLimit SINGLE нь 1 frame. Иймээс **216 → 3×32 + 2×16 + 1 = 129** IF/SINGLE-д нийцсэн frame байна.

ERROR тусгаарлалтыг нэмж хэрэглэвэл: зөв Normal frame 2 валют×2 орчин=4, SINGLE=1; From-ийн хоёр алдаа 2×2×2=8; To-ийн хоёр алдаа 2×2×2=8; Zero/Negative 2×2×2=8; OverBalance 2, OverLimit 2. Нийт **129 → 4+1+8+8+8+2+2 = 33** frame. Иймд бүрэн category-partition шүүлт **216 → 33**; завсрын 129 нь IF/SINGLE шүүлтийн хэмжээ юм. Доорх A3 нь эдгээрээс утга учиртайг сонгосон гар ажиллагааны багц бөгөөд давуу эрэмбэ шалгах нэг давхар алдаатай нэмэлт frame агуулна.

`transfer-nc.model` нь 216 frame-ийн хязгаарлалтгүй орон зай, `transfer.model` нь 129 frame-ийн IF/SINGLE орон зай, `transfer-neg.model` нь 33 frame-ийн ERROR тусгаарласан орон зайг илэрхийлнэ. Pairwise үүсгэгч эдгээр орон зайг бүгдийг жагсаахгүй, зөвшөөрөгдөх хосуудыг хамрах дэд багц сонгоно. `~` нь дээрх IF болон SINGLE хязгаарлалтыг орлохгүй.

## A3 Гараар сонгосон спецификациуд

`d` багана хөрвүүлсний дараах MNT дүн; JSON дахь amount нь Currency-ийн дүрмээр тооцогдоно. Бүх алдааны статус **200**, зөв шилжүүлгийн статус **201** байна.

| ID | From | To | Amount | Currency | DailyUsage | d MNT | Хүлээгдэх статус ба result |
|---|---|---|---|---|---|---:|---|
| A01 | Valid | Valid | Normal | Same | Fresh | 100 | 201 OK |
| A02 | Valid | Valid | Normal | Different | Fresh | 100 | 201 OK |
| A03 | Valid | Valid | Normal | Same | Used | 100 | 201 OK |
| A04 | Valid | Valid | Normal | Different | Used | 100 | 201 OK |
| A05 | Missing | Valid | Normal | Same | Fresh | 100 | 200 ERROR_NO_FROM |
| A06 | Frozen | Valid | Normal | Same | Fresh | 100 | 200 ERROR_FROZEN |
| A07 | Valid | Missing | Normal | Same | Fresh | 100 | 200 ERROR_NO_TO |
| A08 | Valid | SameAsFrom | Normal | Same | Fresh | 100 | 200 ERROR_SAME_ACCOUNT |
| A09 | Valid | Valid | Zero | Same | Fresh | 0 | 200 ERROR_BAD_AMOUNT |
| A10 | Valid | Valid | Negative | Different | Fresh | -1 | 200 ERROR_BAD_AMOUNT |
| A11 | Valid | Valid | OverBalance | Different | Fresh | 1001 | 200 ERROR_INSUFFICIENT |
| A12 | Valid | Valid | OverLimit | Different | Used | 501 | 200 ERROR_LIMIT |
| A13 | Valid | Valid | ExactLimit | Same | Used | 500 | 201 OK — SINGLE, used+d=2000 |
| A14 | Frozen | SameAsFrom | Normal | Same | Fresh | 100 | 200 ERROR_FROZEN — хоёр алдаанаас FROZEN түрүүлнэ |

A14 нь эх данс царцаатай бөгөөд өөр лүүгээ шилжүүлж байгаа сонирхолтой давхар нөхцөл. Энэ мөр IF/SINGLE шүүлтэд зөвшөөрөгдөнө, харин ERROR тусгаарласан 33 frame-д орохгүй; эрэмбийг тусгайлан шалгах нэмэлт тест болно. A11, A12-ын USD дүнг эхлээд MNT-д хөрвүүлэхгүйгээр шалгавал буруу шийдвэр гарахыг oracle нь илрүүлнэ.

## B1 Браузерын pairwise ба 3 way загвар

[browser.model](browser.model) файл нь лекцийн 3×3×2×2×2×2 = **144** бүрэн тохиргоотой жишээг өөрчлөлтгүй агуулна. PICT-ийг [Microsoft-ийн эх кодоос](https://github.com/microsoft/pict) Windows дээр portable GCC болон GNU Make ашиглан бүтээсэн. Эх кодын commit, toolchain, build команд, жинхэнэ хэрэглээний гаралт [results/pict-build.txt](results/pict-build.txt) файлд бий; эх код, compiler, binary нь repository-оос гадна хадгалагдсан.

```sh
pict browser.model > results/browser-2way.txt
pict browser.model /o:3 > results/browser-3way.txt
```

| Багц | Тестийн мөрийн тоо, толгойг оруулаагүй | 144-өөс эзлэх хувь | Нотолгоо |
|---|---:|---:|---|
| Бүрэн олонлог | 144 | 100% | 3×3×2×2×2×2 |
| Лекцийн гар ажиллагааны 2-way | 9 | 6.25% | Даалгаварт өгсөн харьцуулах утга |
| PICT 2-way | 10 | 6.94% | [browser-2way.txt](results/browser-2way.txt) |
| PICT 3-way | 20 | 13.89% | [browser-3way.txt](results/browser-3way.txt) |

PICT-ийн 2-way багц **10 мөр**, лекцийн гар ажиллагааны 9 мөрөөс нэгээр олон гарсан. PICT нь greedy аргаар хамрагдаагүй хосуудыг нэмж хамрах мөр сонгодог тул хамралтыг хангах боловч хамгийн бага мөрийн тоог заавал олохгүй. 3-way нь гурван параметрийн нийлсэн сонголтуудыг хамрахын тулд 20 мөр шаардсан нь энэ ажиллуулалтад 2-way-аас хоёр дахин олон боловч бүрэн 144 тохиргооноос 124-өөр цөөн юм.

## B2 Шилжүүлгийн PICT загварууд

Гурван файлд ижил таван параметр, ижил дараалалтай төлөөлөх утгууд ашигласан. [transfer-nc.model](transfer-nc.model) нь хязгаарлалтгүй, [transfer.model](transfer.model) нь A2-ын IF/SINGLE дүрэмтэй, [transfer-neg.model](transfer-neg.model) нь мөн тэдгээр дүрэм дээр ERROR сонголтын өмнө `~` нэмсэн хувилбар юм. PICT-ийн constraint дотор утгын нэрийг `~`-гүй бичнэ; гаралтын файл дахь `~` нь JSON-ын өгөгдөл бус, сөрөг тестийн тэмдэглэгээ.

```sh
pict transfer-nc.model > results/transfer-nc.txt
pict transfer.model > results/transfer.txt
pict transfer-neg.model > results/transfer-neg.txt
```

Бүх таван үндсэн гаралтыг `/r` болон seed өөрчлөх сонголтгүй үүсгэсэн. Дахин ажиллуулахад мөрийн агуулга, дараалал нь хадгалсан файлтай ижил байв. Мөрийн тоог эхний толгой мөрийг хасаж тоолно.

### Мөрийн тоо ба алдааны давхцал

Энд **алдааны сонголтын тоо** гэдэг нь From, To, Amount-ийн A1-д `[ERROR]` гэж тэмдэглэсэн сонголт хэд орсныг хэлнэ. Happy path-ийг зөвхөн тэмдэглэгээгээр биш, A1-ийн setup ба хөрвүүлсний дараах дүрмээр `201 OK` болох эсэхээр тоолсон.

| PICT хувилбар | Боломжит frame | Гаралтын мөр | Happy path | Нэг мөрийн ERROR сонголт min–max | 0 / 1 / 2 / 3 ERROR сонголттой мөр |
|---|---:|---:|---:|---|---|
| [Хязгаарлалтгүй](results/transfer-nc.txt) | 216 | **18** | **0** | 1–3 | 0 / 6 / 6 / 6 |
| [IF ба SINGLE](results/transfer.txt) | 129 | **16** | **1** | 0–3 | 1 / 4 / 5 / 6 |
| [IF ба SINGLE болон сөрөг утга](results/transfer-neg.txt) | 33 | **22** | **5** | 0–1 | 5 / 17 / 0 / 0 |

Хязгаарлалтгүй 18 мөрөнд happy path огт гараагүй: pairwise нь Valid+Valid зэрэг хосыг хамарсан ч **бүх** параметр зэрэг зөв байхыг батлахгүй. IF/SINGLE хувилбарын ганц happy path нь 11 дэх өгөгдлийн мөрийн ExactLimit тест; Normal бүхий зөв шилжүүлэг энд ч гараагүй. Харин negative хувилбарын эхний таван мөр нь дөрвөн Normal тохиргоо болон нэг ExactLimit SINGLE бөгөөд 17 сөрөг мөр бүр нэг ERROR сонголттой.

`transfer.txt`-ийн 2 дахь мөр `Frozen / SameAsFrom / Zero / Different / Fresh` гэсэн **гурван** алдаатай. Сонгосон эрэмбээр зөвхөн ERROR_FROZEN харагдах тул энэ мөрөөр ERROR_SAME_ACCOUNT, ERROR_BAD_AMOUNT тус бүрийг шалгасан гэж тооцож болохгүй; энэ нь error masking юм. IF/SINGLE дүрмүүд хүчинтэй орчны хослолыг хязгаарладаг боловч эх данс, хүлээн авагч, дүнгийн алдааг хооронд нь тусгаарладаггүй.

Хязгаарлалтгүй багцад алдааны сонголтын тоо болон зөрчсөн бизнес дүрмийн тоо адил байх албагүй. Жишээлбэл `transfer-nc.txt`-ийн 5 дахь мөр `Frozen / Missing / OverLimit / Different / Fresh` үед R=2000, d=2001 тул **FROZEN, NO_TO, INSUFFICIENT, LIMIT гэсэн дөрвөн нөхцөл** зэрэг буруу боловч ERROR сонголт нь гурав байна. 1 дэх мөрийн ExactLimit+Fresh нь d=2000 тул лимиттэй тэнцүү ч 1000 үлдэгдлээс их; Missing хүлээн авагчийн алдаа үүнийг нууна. Эх данс байхгүй үед хөрвүүлэлт, үлдэгдлийг API дээр цааш шалгах боломжгүй тул хүснэгт дэх ERROR сонголтуудыг бие даан ажиглагдсан API алдаа гэж ойлгохгүй.

`~` нь нэг мөрөнд хамгийн ихдээ нэг сөрөг утга оруулж дээрх алдаа хоорондын masking-ийг арилгасан. Тэгэхдээ **IF/SINGLE хэрэгтэй хэвээр**: OverBalance+Used нь 1001>1000 бөгөөд 1001>500; OverLimit+Fresh нь 2001>1000 бөгөөд 2001>2000 болж ганц сөрөг нэр хоёр мөнгөн дүрмийг зэрэг зөрчинө. Тэдгээрийг IF дүрмээр салгаж, ExactLimit-ийн сонгосон ганц нөхцөлийг SINGLE дүрмээр тогтооно. To=SameAsFrom үед эх данс байх IF нь `~` тусгаарлалттай үед давхар хамгаалалт болдог ч хоёр моделийн ижил семантикийг хадгалах үүднээс үлдээсэн.

Сөрөг хувилбарын 22 мөр нь хязгаарлалттай 16 мөрөөс олон байгаа нь чанар муудсаны шинж биш: өмнө нь нэг мөрөнд бөөгнөрч байсан алдаануудыг одоо хүчинтэй бусад утгатай тус тусад нь хослуулан шалгаж байна. Хосын хамралт нь тухайн модельд **зөвшөөрөгдсөн** хосуудын тухай; хоёр сөрөг утгын хос negative загварын зорилтот олонлогт орохгүй.

### PICT гаралтаас гаргасан бодит тест кейсүүд

Мөрийн дугаар нь толгойг тооцоогүй **өгөгдлийн мөрийн дугаар**; текст редакторын line number нь үүнээс нэгээр их. Тест бүрийн өмнө A1-ийн тогтмол ханш, дансны валют, үлдэгдэл, өдрийн хэрэглээг шинээр тохируулна. `~` тэмдэг JSON-д орохгүй.

| Кейс ба эх сурвалж | Setup | POST /transfer JSON body | Oracle |
|---|---|---|---|
| T01 — [transfer-neg](results/transfer-neg.txt), мөр 2: Valid / Valid / Normal / Different / Fresh | A100 идэвхтэй, balance=1000 MNT, used=0, limit=2000; A200 оршин байна; 1 USD=2 MNT. | `{"from":"A100","to":"A200","amount":50,"currency":"USD"}` | **201** `{"result":"OK"}`. 50×2=100≤1000, 0+100≤2000; валют хөрвүүлсэн happy path. |
| T02 — [transfer-neg](results/transfer-neg.txt), мөр 6: Valid / Valid / ~OverLimit / Different / Used | A100 идэвхтэй, balance=1000, used=1500, limit=2000; A200 оршин байна; ханш 2. | `{"from":"A100","to":"A200","amount":250.5,"currency":"USD"}` | **200** `{"result":"ERROR_LIMIT"}`. d=501≤1000 боловч 1500+501=2001>2000; ганц алдаа. |
| T03 — [transfer](results/transfer.txt), мөр 2: Frozen / SameAsFrom / Zero / Different / Fresh | F100 оршин байгаа, frozen=true, balance=1000, used=0, limit=2000; to нь мөн F100; ханш 2. | `{"from":"F100","to":"F100","amount":0,"currency":"USD"}` | **200** `{"result":"ERROR_FROZEN"}`. FROZEN нь SAME_ACCOUNT болон BAD_AMOUNT-аас өмнө шалгагдана. |
| T04 — [transfer-neg](results/transfer-neg.txt), мөр 20: Valid / Valid / ~OverBalance / Different / Fresh | A100 идэвхтэй, balance=1000, used=0, limit=2000; A200 оршин байна; ханш 2. | `{"from":"A100","to":"A200","amount":500.5,"currency":"USD"}` | **200** `{"result":"ERROR_INSUFFICIENT"}`. d=1001>1000 боловч 1001≤2000; ганц алдаа. |
| T05 — [transfer](results/transfer.txt), мөр 11: Valid / Valid / ExactLimit / Same / Used | A100 идэвхтэй, balance=1000, used=1500, limit=2000; A200 оршин байна. | `{"from":"A100","to":"A200","amount":500,"currency":"MNT"}` | **201** `{"result":"OK"}`. 1500+500=2000: лимитээс хэтрээгүй; SINGLE заагийн тест. |

## B3 Хоёр аргын харьцуулалт

| Шинж | Гараар хийсэн A3 | PICT-ийн гаралт |
|---|---|---|
| Алдааны утга, oracle | 14 мөр бүрийн зорилго, 7 төрлийн ERROR, зааг, эрэмбэ шууд тодорхой. | Модель утгуудыг хослуулна; oracle, setup, ханшийг хүн тодорхойлох шаардлагатай. |
| Хосын хамралт | A3-д бүх хосыг хамарсан гэж батлаагүй. | Модельд зөвшөөрөгдсөн бүх 2-way хосыг хамарна; браузерын /o:3 нь бүх зөвшөөрөгдөх гурвалтыг хамарна. |
| Давхар алдаа | A14-ийг зориуд сонгож, эрэмбийг тайлбарласан. | Энгийн утгатай загварт олон давхар алдаа үүссэн; `~` тусгаарлана. |
| Зааг ба бизнес дүрэм | Zero, Negative, ExactLimit зэрэг утгыг учиртай сонгож болно. | Оруулсан утгуудаас л сонгоно; дутуу сонголт, буруу constraint-ийг өөрөө засахгүй. |
| Засварлахад | Шинэ параметр нэмэхэд хүснэгт, хослолыг гараар дахин хянах хэрэгтэй. | Моделийг өөрчилж дахин үүсгэхэд хурдан ч setup, oracle, coverage-ийг дахин шалгана. |

## Дахин ажиллуулах ба шалгах

Windows дээр энэ ажлын binary нь `%TEMP%\lab6-pict-source-build\pict\pict.exe` байрлалтай. PATH-д түр нэмэх эсвэл executable-ийн бүтэн замаар дээрх командуудыг ажиллуулж болно; эх кодоос дахин бүтээх командууд [pict-build.txt](results/pict-build.txt)-д бий. Linux/macOS дээр ижил commit-ийг repository-оос гадна clone хийж `make` ажиллуулаад үүссэн PICT-ээр дээрх таван командыг гүйцэтгэнэ. Модель болон утгуудын дарааллыг өөрчлөхгүй, санамсаргүй seed хэрэглэхгүй.

```powershell
# PowerShell 5.1-ийн > нь UTF-16 бичдэг тул UTF-8-ийг зориуд сонгоно.
$pictExe = Join-Path $env:TEMP 'lab6-pict-source-build\pict\pict.exe'
& $pictExe browser.model | Set-Content -Encoding UTF8 results/browser-2way.txt
& $pictExe browser.model /o:3 | Set-Content -Encoding UTF8 results/browser-3way.txt
& $pictExe transfer-nc.model | Set-Content -Encoding UTF8 results/transfer-nc.txt
& $pictExe transfer.model | Set-Content -Encoding UTF8 results/transfer.txt
& $pictExe transfer-neg.model | Set-Content -Encoding UTF8 results/transfer-neg.txt
node scripts/verify.mjs
```

[scripts/verify.mjs](scripts/verify.mjs) нь transfer програмын хэрэгжүүлэлт биш, загвар ба хадгалсан хүснэгтүүдийн бие даасан шалгагч. Node.js-ийн стандарт сангаар бүрэн олонлогийг тоолж, хязгаарлалт, давхардсан мөр, зөвшөөрөгдөх хос/гурвалтын хамралт, алдааны тархалт, happy path-ийг шалгана. Шалгалтын нотолгоо [results/verification.txt](results/verification.txt)-д хадгалагдана.

| Шалгасан гаралт | Хамарсан / зөвшөөрөгдөх хос буюу гурвалт | Үр дүн |
|---|---:|---|
| browser-2way | 81 / 81 хос | PASS |
| browser-3way | 248 / 248 гурвалт | PASS |
| transfer-nc | 97 / 97 хос | PASS |
| transfer | 88 / 88 хос | PASS |
| transfer-neg | 69 / 69 хос | PASS |

Таван файлд давхардсан мөр байхгүй. IF/SINGLE болон negative хувилбарт ExactLimit тус бүр яг нэг мөрөөр орсон; negative гаралтын бүх сөрөг мөр нэг л алдааны нөхцөлтэй байна.

## Дүгнэлт

Category-partition арга нь шаардлагыг сонголт, нөхцөл, хүлээгдэх үр дүн болгон задлахад тусалсан. Гараар боловсруулсан 14 спецификаци happy path, бүх долоон алдааны ангилал, лимитийн зааг болон нэг давхар алдааг ойлгомжтой шалгана. PICT нь хүний сонгосон түвшин, хязгаарлалтын хүрээнд хосын хамралтыг хангаж, гар ажиллагааны хүснэгтэд орхигдож болох харилцан нөлөөг гаргаж өгсөн. Браузерын 2-way багц 10, 3-way багц 20 мөр болсон нь бүрэн 144 тохиргооноос цөөн боловч greedy алгоритм хамгийн бага хэмжээг батлахгүйг харууллаа. Шилжүүлгийн хязгаарлалтгүй 18 мөрөнд happy path байхгүй байсан нь pairwise хамралтыг бүх нөхцөл зэрэг зөв байхтай андуурч болохгүйг харуулсан. IF/SINGLE хувилбар 16 мөр болсон ч олон алдаа нэг мөрөнд үлдсэн тул oracle-д давуу эрэмбэ хэрэгтэй байв. Negative хувилбарын 22 мөрд нэг ERROR сонголтын дүрэм хангагдсан ч санхүүгийн давхар зөрчлийг зайлуулах IF болон ганц заагийн SINGLE хязгаарлалт хэрэгтэй хэвээр байна. Хамгийн их бодол шаардсан алхам нь валют хөрвүүлсний дараах үлдэгдэл, өдрийн хэрэглээ, алдааны эрэмбийг хооронд нь зөрчилгүй загварчлах байсан. Цаашид хоёр аргыг хамтад нь хэрэглэж, энэ багцад нарийвчлан хамраагүй үлдэгдэлтэй яг тэнцүү дүн, лимит бүрэн дуусах төлөв, хөрвүүлэлттэй яг лимитийн заагийг нэмэн шалгана.

## Файлууд ба эх сурвалж

- `README.md` — A1–A3, B1–B3, тооцоо, бодит кейс, дүгнэлт.
- `browser.model`, `transfer-nc.model`, `transfer.model`, `transfer-neg.model` — PICT-ийн дөрвөн модель.
- `results/` — эх кодоос бүтээсэн нотолгоо, таван PICT гаралт, бие даасан шалгалтын дүн.
- `scripts/verify.mjs` — хүсвэл дахин ажиллуулах хамралтын шалгагч.
- [Microsoft PICT](https://github.com/microsoft/pict), [хэрэглэгчийн заавар](https://github.com/microsoft/pict/blob/ab76c2548f551fcb46314e58653a1bd1172f3a72/doc/pict.md) — модель, constraints, negative testing-ийн албан эх сурвалж.

Зааврын DOCX, PICT-ийн эх код, compiler болон binary repository-д ороогүй. Ажлыг A хэсэг, PICT build ба B1, шилжүүлгийн B2, эцсийн тайлан ба шалгалт гэсэн үе шатуудаар commit хийсэн. Teams-д илгээхдээ энэ public repository-ийн холбоосыг Assignment-д оруулж **Turn in** дарна; repository үүссэн нь Teams-д илгээгдсэн гэсэн үг биш.
