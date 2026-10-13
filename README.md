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
