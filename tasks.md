# Homework Module Upgrade Plan

## Goal
להפוך את מודול ה־`homework` למערכת יציבה, נוחה לניהול, ותומכת בכמה תרגילי בית פתוחים במקביל, עם חלונות זמינות ברורים, מסלולי כניסה ייעודיים, ותצוגת runner ברורה יותר לסטודנטים.

המסמך הזה מתמקד ביישום מעשי בתוך הקוד הקיים, ולא רק בתיאור מוצר. הוא מתייחס במיוחד לאזורים הבאים:
- `app/homework/start`
- `app/homework/runner/[setId]`
- `app/homework/builder`
- `app/api/homework`
- `lib/homework.ts`
- `app/homework/types.ts`
- בדיקות ב־`__tests__` ו־`tests/e2e`

---

## Product Decisions To Lock Before Coding

### 1. Dedicated student entry path per homework
החלטה מומלצת:
- להשאיר את ` /homework/start ` כדף מרכזי שמציג את כל התרגילים הזמינים כרגע.
- להוסיף נתיב ייעודי ` /homework/start/[setId] ` עבור קישור ישיר לתרגיל ספציפי.
- כל תרגיל יקבל לינק קבוע שאפשר לשתף עם הסטודנטים.

למה:
- פותר את הבעיה של "אפשר רק תרגיל אחד".
- מאפשר לפתוח כמה תרגילים במקביל.
- לא שוברים לינקים קיימים אם שומרים תאימות ל־`?setId=...`.

### 2. Availability window
לכל Homework Set חייבים להיות:
- `availableFrom`
- `availableUntil`

כלל זמינות:
- לפני `availableFrom` התרגיל לא זמין לסטודנט.
- בין `availableFrom` ל־`availableUntil` התרגיל זמין.
- אחרי `availableUntil` התרגיל לא זמין.

החלטה מומלצת:
- `dueAt` יהפוך לשדה legacy בלבד או יוחלף לחלוטין ב־`availableUntil`.
- אם יש תלות קיימת ב־`dueAt`, לשמור תאימות זמנית ולמפות:
  - `availableUntil ?? dueAt`

### 3. Question content model
לכל שאלה צריך להיות מפורש:
- `prompt`: מה השאלה עצמה
- `expectedOutputDescription`: מה הפלט הרצוי

לא להסתפק בשדה חופשי אחד.

### 4. Homework-level data structure explanation
ההסבר על מבנה הנתונים צריך להיות זמין גם בתוך ה־runner, לא רק ב־`/homework/start`.

החלטה מומלצת:
- לשמור את ההסבר ברמת ה־Homework Set או Dataset linkage, ולא רק כטקסט חופשי בתצוגת פתיחה.
- להציג אותו בפאנל הימני מעל רשימת הטבלאות ב־runner.

---

## Current Gaps In The Existing Code

### Data model gaps
- ב־`app/homework/types.ts` יש `dueAt` אך אין `availableFrom` / `availableUntil`.
- אין שדה מסודר עבור `expectedOutputDescription` ברמת שאלה.
- יש `backgroundStory`, אבל אין הבחנה ברורה בין:
  - intro / overview
  - dataset structure explanation
  - student instructions

### Access control gaps
- ב־`lib/deadline-utils.ts` הפונקציה `isHomeworkAccessible()` כרגע תמיד מחזירה `true`.
- אין אכיפה אמיתית של חלון זמן.
- אין סטטוס ברור של homework מסוג:
  - draft
  - scheduled
  - open
  - closed
  - archived

### Student entry gaps
- `StudentEntryClient.tsx` עדיין עובד סביב set selection בסיסי ו־query param.
- אין route ייעודי לכל תרגיל.
- הסינון של תרגילים פתוחים/סגורים חלקי בלבד ומבוסס על `published`.

### Runner UX gaps
- ב־runner אין הצגה ברורה של:
  - הסבר על מבנה הנתונים
  - prompt של השאלה
  - expected output נפרד וברור
- נדרש לחדד את המידע שמופיע באזור העליון של העמודה המרכזית.

### Builder/Admin gaps
- ב־builder יש כרגע `dueAt`, אבל לא טווח זמינות מלא.
- חסר מסך ניהול טוב לראות כמה תרגילים פתוחים במקביל.
- חסרות ולידציות פרסום חזקות לפני publish.

---

## Sprint 1: Data Model And Backend Contracts

### Objective
להניח בסיס יציב ב־types, persistence ו־API כדי לאפשר כמה תרגילים פתוחים במקביל עם חלונות זמינות אמיתיים.

### Tasks

#### 1. Extend HomeworkSet schema
לעדכן את `app/homework/types.ts` ואת המודלים בשרת כך של־HomeworkSet יהיו:
- `availableFrom: string`
- `availableUntil: string`
- `slug?: string` או להשתמש ב־`setId` כנתיב canonical
- `entryMode?: "direct" | "listed" | "hidden"`
- `dataStructureNotes?: string`

DONE:
- הוחלט להשתמש ב־`setId` כנתיב canonical, ללא `slug` בשלב זה.
- נוספו שדות availability / entry mode / data structure notes בצורה backward-compatible ב־types ובמודלי השרת.
- נוספו fallback-ים לרשומות ישנות (`availableUntil ?? dueAt`, ו־`availableFrom` מתוך `createdAt` או ברירת מחדל בטוחה).

#### 2. Extend Question schema
לעדכן את `Question` ב־`app/homework/types.ts`:
- להשאיר `prompt`
- להשאיר/לצמצם `instructions`
- להוסיף `expectedOutputDescription: string`

DONE:
- נוסף `expectedOutputDescription` לשכבת ה־Question וה־API של יצירת שאלות.
- בוצע fallback לרשומות ישנות כדי שלא יישברו שאלות קיימות.
- ההבחנה שנקבעה במימוש:
  - `prompt` = נוסח המשימה
  - `expectedOutputDescription` = מבנה/תיאור הפלט המצופה
  - `instructions` = הנחיות משלימות בלבד

#### 3. Update persistence layer
לעדכן את `lib/homework.ts` ואת כל mapping השכבות:
- create
- read
- update
- list

DONE:
- שכבת ה־persistence עודכנה כך שכל השדות החדשים נשמרים ונשלפים ב־create/read/update/list.
- נוספה שכבת normalization ל־HomeworkSet ול־Question עבור migration logic ורשומות legacy.
- נשמרה תאימות ל־sets קיימים דרך `dueAt` כשדה legacy ממופה ל־`availableUntil`.

#### 4. Replace deadline-only logic with availability window logic
לעדכן `lib/deadline-utils.ts`:
- להחליף `isHomeworkAccessible(dueAt, userEmail)` למודל שעובד עם:
  - `availableFrom`
  - `availableUntil`
  - הארכות פרטניות אם עדיין צריך

DONE:
- נוספו הפונקציות:
  - `getAvailabilityState(homework, userEmail)`
  - `isHomeworkAccessible(homework, userEmail)`
  - `getAvailabilityMessage(homework, userEmail)`
  - `getHomeworkAvailabilityInfo(homework, userEmail)`
- הוגדרו states:
  - `upcoming`
  - `open`
  - `closed`
- נשמרה תמיכה בהארכות פרטניות על סוף חלון הזמינות.

#### 5. Update API contracts
לעדכן:
- `app/api/homework/route.ts`
- `app/api/homework/[setId]/route.ts`

DONE:
- `GET /api/homework` מחזיר availability metadata לכל set.
- `GET /api/homework/[setId]` אוכף גישה לסטודנט לפי חלון זמן, published/archived ו־entry mode.
- builder/admin/instructor עוקפים חסימות זמן וגישה של סטודנטים.
- נוסף filter של `availableOnly=true` עבור "רק תרגילים זמינים כרגע".

### Acceptance Criteria
- [x] אפשר לשמור Homework Set עם `availableFrom` ו־`availableUntil`.
- [x] ה־API מחזיר סטטוס זמינות עקבי.
- [x] Homework סגור אינו נגיש לסטודנט דרך ה־API.
- [x] Homework עתידי אינו נגיש לסטודנט לפני זמן הפתיחה.

---

## Sprint 2: Student Entry Flow And Multi-Homework Support

### Objective
לאפשר כמה תרגילים פתוחים בו־זמנית, עם כניסה דרך דף רשימה ודרך לינק ישיר.

### Tasks

#### 1. Add dedicated route for specific homework
להוסיף:
- `app/homework/start/[setId]/page.tsx`

DONE:
- לטעון את התרגיל הספציפי לפי `setId`.
- להציג הודעת מצב אם התרגיל:
  - טרם נפתח
  - נסגר
  - לא פורסם
  - לא נמצא
- לשמר flow של login ואז entry ל־runner.

Implementation notes:
- נוסף route ייעודי `app/homework/start/[setId]/page.tsx`.
- ה־route טוען את `StudentEntryClient` במצב direct-entry לפי `setId`.
- העמוד מציג הודעת מצב מפורטת עבור:
  - homework עתידי
  - homework סגור
  - homework לא זמין לסטודנטים
  - homework שלא נמצא
- כאשר homework פתוח, ה־flow נשאר: login -> מסך פתיחה/הנחיות -> runner.

#### 2. Upgrade `/homework/start`
לעדכן `app/homework/start/page.tsx` + `app/homework/StudentEntryClient.tsx`

DONE:
- להפוך את הדף לרשימת תרגילים זמינים כרגע.
- להציג לכל כרטיס:
  - שם התרגיל
  - קורס
  - חלון זמינות
  - סטטוס: נפתח בקרוב / פתוח / נסגר
  - כפתור כניסה
- אם יש רק תרגיל אחד פתוח, לא להניח שהוא היחיד בעולם; עדיין להציג מודל אחיד.

Implementation notes:
- `StudentEntryClient` הוסב ממסך בחירה ישן למסך רשימת מטלות עם כרטיסים.
- כל כרטיס מציג:
  - שם המטלה
  - קורס
  - חלון זמינות
  - מספר שאלות
  - סטטוס זמינות
  - כפתור מעבר לעמוד הייעודי
- הסדר ברשימה הוא:
  - open
  - upcoming
  - closed
- גם אם יש רק תרגיל אחד פתוח, עדיין מוצג אותו מודל רשימה אחיד.

#### 3. Keep backward compatibility
DONE:
- לתמוך זמנית גם ב־`/homework/start?setId=...`.
- להפנות בהמשך ל־route החדש.

Implementation notes:
- `app/homework/start/page.tsx` תומך זמנית ב־`?setId=...`.
- בקשה כזו עושה redirect מיידי ל־`/homework/start/[setId]`.
- redirect-ים מתוך ה־runner עודכנו גם הם ל־route החדש.

#### 4. Clarify student-facing messaging
DONE:
- אם homework עוד לא נפתח, להראות תאריך פתיחה מדויק.
- אם homework נסגר, להראות תאריך סגירה מדויק.
- להציג תאריכים בפורמט עברי ברור.

Implementation notes:
- הודעות החסימה לסטודנט נשענות על ה־availability message מה־API.
- חלונות הזמינות מוצגים בפורמט `he-IL` עם תאריך ושעה.
- בעמוד הישיר של מטלה סגורה/עתידית מוצגת גם הודעת מצב וגם חלון הזמינות.

### Acceptance Criteria
- [x] יכולים להיות כמה Homework Sets published/open במקביל.
- [x] לכל אחד יש לינק ייעודי עובד.
- [x] `/homework/start` מציג רשימה אמיתית של available homeworks.
- [x] סטודנט לא נכנס בטעות לתרגיל סגור/עתידי.

---

## Sprint 3: Runner Information Architecture

### Objective
לשפר את חוויית הסטודנט בתוך ` /homework/runner/[setId] ` כך שהמידע הקריטי יופיע במקום הנכון.

### Tasks

#### 1. Add homework data structure explanation above tables
לעדכן:
- `app/homework/runner/[setId]/RunnerClient.tsx`
- `app/homework/runner/[setId]/InstructionsSection.tsx`

DONE:
- להציג בפאנל הימני, מעל רשימת הטבלאות:
  - `dataStructureNotes` או equivalent
- אם אין הסבר ייעודי, להשתמש fallback מתוך `backgroundStory`.
- להפריד ויזואלית בין:
  - הסבר על מבנה הנתונים
  - רשימת הטבלאות

Implementation notes:
- נוסף בלוק "מבנה הנתונים" מעל טבלאות הדוגמה בתוך ה־runner.
- הבלוק משתמש קודם ב־`dataStructureNotes`, ואם הוא חסר מבצע fallback ל־`backgroundStory`.
- לטבלאות נוספה כותרת נפרדת כך שההבחנה בין הסבר מבני לבין נתוני הדוגמה ברורה יותר.

#### 2. Redesign question header area in center column
DONE:
- בחלק העליון של העמודה המרכזית להציג בבירור:
  - מספר שאלה
  - `prompt`
  - `expectedOutputDescription`
  - instructions משלימות אם קיימות
- ה־progress bar לא אמור להיות המקום היחיד לטקסט המשימה.
- ליצור layout עקבי בין כל השאלות.

Implementation notes:
- אזור הכותרת במרכז הוסב לגריד של כרטיסי מידע קבועים לכל שאלה.
- כל שאלה מציגה כעת באופן עקבי:
  - מספר שאלה
  - נוסח המשימה (`prompt`)
  - תיאור הפלט המצופה (`expectedOutputDescription`)
  - הנחיות משלימות אם קיימות
- ה־stepper נשאר רכיב ניווט בלבד.

#### 3. Improve question metadata model in UI
DONE:
- להפסיק להעמיס את כל התוכן לתוך `instructions`.
- לבנות קומפוננטות קטנות:
  - `QuestionPromptCard`
  - `ExpectedOutputCard`
  - `QuestionTipsCard` אם צריך

Implementation notes:
- נוספו קומפוננטות ייעודיות עבור `prompt`, `expected output` ו־`tips`.
- ה־runner בונה כעת את אזור המידע של השאלה מתוך קומפוננטות קטנות וברורות במקום בלוק טקסט יחיד.

#### 4. Improve empty/fallback states
DONE:
- אם חסר `expectedOutputDescription`, להציג placeholder ברור למרצה במצב preview/builder.
- לסטודנט לא להציג UI שבור או ריק.

Implementation notes:
- כאשר `expectedOutputDescription` חסר, נעשה fallback לסכמת התוצאה אם קיימת.
- במצב `student-demo` מוצג placeholder ברור יותר שמאותת למרצה שחסר תיאור פלט מפורש.
- לסטודנט מוצג טקסט fallback שימושי במקום אזור ריק.

### Acceptance Criteria
- [x] הסטודנט רואה בצד ימין גם הסבר על מבנה הנתונים וגם טבלאות.
- [x] הסטודנט רואה במרכז למעלה גם את השאלה וגם את תיאור הפלט הרצוי.
- [x] כל שאלה נראית עקבית וברורה יותר.

---

## Sprint 4: Builder UX And Instructor Workflow

### Objective
להפוך את ה־builder לכלי נוח לניהול אינטנסיבי של כמה תרגילים במקביל לאורך הסמסטר.

### Tasks

#### 1. Add availability fields to builder metadata
לעדכן:
- `app/homework/builder/components/wizard/types.ts`
- `app/homework/builder/components/wizard/MetadataStep.tsx`
- `app/homework/builder/components/wizard/PublishStep.tsx`

DONE:
- להחליף `dueAt` ב־:
  - `availableFrom`
  - `availableUntil`
- להוסיף ולידציה:
  - start < end
  - אי אפשר publish בלי חלון תקין

Implementation notes:
- שכבת ה־draft של ה־builder הוסבה ל־`availableFrom` / `availableUntil`, תוך שמירה על `dueAt` רק כ־payload legacy לשרת.
- נוספה ולידציית client-side שמונעת התקדמות/פרסום כאשר חלון הזמינות חסר או לא תקין.
- מסך הפרסום מציג כעת את חלון הזמינות במקום תאריך הגשה יחיד.

#### 2. Add data structure explanation field in builder
DONE:
- לאפשר למרצה להגדיר בנפרד:
  - intro / overview
  - data structure notes
- להציג preview של איך זה ייראה ב־runner.

Implementation notes:
- נוספה ב־metadata שדה נפרד עבור `dataStructureNotes`.
- ב־metadata step נוסף preview מובנה שמראה את ההבחנה בין פתיח המטלה לבין פאנל "מבנה הנתונים" ב־runner.
- תצוגת ה־preview של המטלה מציגה עכשיו גם את הפתיח וגם את הסבר מבנה הנתונים כפי שהסטודנט יראה אותם.

#### 3. Improve question authoring
DONE:
- לחייב לכל שאלה:
  - `prompt`
  - `expectedOutputDescription`
- להבדיל בטופס העריכה בין:
  - מה הסטודנט צריך לעשות
  - מה הפלט שהוא צריך לקבל
  - הנחיות נוספות

Implementation notes:
- `QuestionDraft` עודכן כך שיכלול `expectedOutputDescription`.
- טופס יצירת השאלות הופרד בפועל לשלושה אזורים: ניסוח המשימה, תיאור הפלט הצפוי, והנחיות משלימות.
- המעבר קדימה והפרסום נחסמים כאשר חסר `prompt`, חסר `expectedOutputDescription`, או אין ניקוד תקין.

#### 4. Improve builder dashboard
לעדכן `app/homework/builder/page.tsx` ואולי גם `app/admin/homework/page.tsx`

DONE:
- להוסיף עמודות/פילטרים:
  - upcoming
  - open
  - closed
  - archived
- להציג:
  - start date
  - end date
  - direct link
  - count submissions
- לאפשר copy link לתרגיל.

Implementation notes:
- לוח הבנייה עבר לסינון לפי סטטוסי availability אמיתיים: `draft`, `upcoming`, `open`, `closed`, `archived`.
- כל כרטיס מציג כעת תאריך פתיחה, תאריך סגירה, ספירת הגשות, ציון ממוצע וקישור ישיר לכניסת הסטודנט.
- נוסף כפתור העתקת קישור ישיר ל־`/homework/start/[setId]`.

#### 5. Publish safety checks
DONE:
- לפני publish לבצע validation summary:
  - יש חלון זמינות תקין
  - יש dataset / tables
  - לכל שאלה יש prompt
  - לכל שאלה יש expected output
  - אין question בלי ניקוד

Implementation notes:
- נוספה שכבת validation מרוכזת ל־builder שמייצרת `blockers` ו־`warnings` לפני פרסום.
- מסך ה־wizard ומסך ה־publish הייעודי משתמשים באותה בדיקת בטיחות כדי למנוע publish לא תקין.
- נוספו בדיקות unit חדשות ל־validation של sprint 4.

### Acceptance Criteria
- [x] מרצה יכול לנהל כמה תרגילים במקביל בלי בלבול.
- [x] ברור מה פתוח עכשיו, מה עתידי ומה נסגר.
- [x] ברור מה הסטודנטים יראו בכל תרגיל.

---

## Sprint 5: Tests, Migration, And Hardening

### Objective
לסגור פינות כדי שהמודול יוכל לשמש בעומס אמיתי לאורך סמסטר.

### Tasks

#### 1. Unit tests
להוסיף/לעדכן:
- `__tests__/homework/homeworkStore.test.ts`
- tests חדשים ל־availability logic

DONE:
- בדיקות ל־open/upcoming/closed.
- בדיקות ל־fallback של `dueAt`.
- בדיקות ל־multi-homework listing.

Implementation notes:
- `__tests__/lib/deadline-utils.test.ts` הורחב כדי לכסות `upcoming`, `open`, `closed`, fallback של `dueAt`, ו־fallback של `createdAt`.
- `__tests__/homework/homeworkStore.test.ts` הורחב כדי לוודא ששכבת ה־mock store שומרת availability fields, `entryMode` ו־`expectedOutputDescription`.
- נוסף גם `__tests__/lib/homework-migration.test.ts` כדי לכסות את ה־backfill logic של migration לנתוני homework legacy.

#### 2. API tests
DONE:
- לבדוק שסטודנט לא מקבל Homework מחוץ לחלון הזמן.
- לבדוק ש־builder כן יכול לטעון לצורך preview/edit.

Implementation notes:
- `__tests__/api/homework.route.test.ts` מכסה כעת:
  - חסימה לסטודנט עבור homework עתידי
  - חסימה לסטודנט עבור homework סגור
  - גישת builder ל־preview/edit גם כאשר homework מחוץ לחלון הזמן
  - החזרת `studentAccess` context כדי להסביר למרצה למה סטודנט חסום

#### 3. E2E tests
לעדכן/להוסיף:
- `tests/e2e/homework-runner.spec.ts`
- `tests/e2e/homework-grading.spec.ts`

DONE:
- תרחיש של שני תרגילים פתוחים במקביל.
- תרחיש של homework עתידי.
- תרחיש של homework סגור.
- תרחיש שבו ב־runner מופיעים:
  - data structure notes
  - prompt
  - expected output

Implementation notes:
- `tests/e2e/homework-runner.spec.ts` הורחב עם mocks ל־`/api/homework` ו־`/api/homework/[setId]` כדי לבדוק באופן דטרמיניסטי:
  - רשימת מטלות עם כמה סטטוסים במקביל
  - direct-entry עבור homework עתידי/סגור
  - נוכחות אזורי `מבנה הנתונים`, `מה צריך לעשות?`, `מה אמור להתקבל?`
- `tests/e2e/homework-grading.spec.ts` נשאר smoke test עבור מסך grading כדי לצמצם regression בזרימת המרצה.

#### 4. Data migration / seed backfill
DONE:
- לקבוע default values ל־homeworks קיימים.
- לכתוב סקריפט migration אם צריך.
- לוודא שלא נעלמים תרגילים ישנים מהדשבורד.

Implementation notes:
- נוסף helper ייעודי ב־`lib/homework-migration.ts` ליצירת ערכי backfill עקביים עבור:
  - `availableFrom`
  - `availableUntil`
  - `dueAt`
  - `entryMode`
- נוסף סקריפט `scripts/backfill-homework-availability.ts` עם dry-run כברירת מחדל ו־`--write` לעדכון בפועל.
- שכבת ה־mock store הוקשחה כדי לשמר את שדות Sprint 1-4 גם בנתוני seed/mock, וכך למנוע "היעלמות" מטלות ישנות בגלל רשומות חלקיות.

#### 5. Observability and admin support
DONE:
- לשפר לוגים עבור access denied בגלל חלון זמן.
- להקל על debugging של "למה הסטודנט לא רואה את התרגיל".

Implementation notes:
- `app/api/homework/[setId]/route.ts` לוגם כעת denied access עם `reason` ו־context מובנה.
- תגובת ה־API כוללת גם `studentAccess` context שמאפשר למרצה/בונה להבין אם החסימה נובעת מ:
  - availability window
  - unpublished
  - archived
  - hidden entry mode

### Acceptance Criteria
- [x] יש כיסוי בדיקות למסלולים הקריטיים.
- [x] אין regression בכניסה, ריצה והגשה.
- [x] אפשר להסביר בקלות למה תרגיל זמין או לא זמין.

---

## Cross-Cutting Refactors

### A. Normalize terminology
להחליט על שמות עקביים:
- `availableFrom` / `availableUntil`
- `dataStructureNotes`
- `expectedOutputDescription`

לא לערבב כמה שמות שונים לאותו רעיון.

### B. Separate student content layers
להפריד בין:
- overview של התרגיל
- הסבר על מבנה הנתונים
- prompt של שאלה
- expected output של שאלה
- instructions משלימות

### C. Reduce hidden logic in free-text fields
כרגע יש יותר מדי לוגיקה שנשענת על טקסט חופשי, כולל transform מיוחד ב־`StudentEntryClient.tsx`.

TODO:
- לצמצם hardcoded transforms.
- להעביר תוכן מובנה לשדות מפורשים.
- לשמור parsing fallback רק לנתונים ישנים.

---

## Suggested Implementation Order

1. Types + DB/service layer
2. Availability utilities + API enforcement
3. Dedicated start route + listing of multiple open homeworks
4. Runner UI restructuring
5. Builder metadata/question forms
6. Dashboard improvements
7. Tests + migration

---

## Definition Of Done

העבודה תיחשב גמורה רק אם כל הסעיפים הבאים מתקיימים:
- יש תמיכה בכמה תרגילי בית פתוחים במקביל.
- לכל תרגיל יש לינק ייעודי עובד.
- לכל תרגיל יש זמן פתיחה וזמן סגירה אמיתיים ומאוכפים.
- ב־runner מופיע הסבר מבנה הנתונים מעל הטבלאות.
- בכל שאלה מופיעים גם נוסח השאלה וגם תיאור הפלט הרצוי.
- builder מאפשר לנהל את כל זה בלי לעקוף ידנית את המערכת.
- יש בדיקות שמכסות את התרחישים הקריטיים.

---

## Nice To Have After Core Delivery

- `slug` אנושי לתרגיל, לא רק `setId`
- duplicate homework / clone previous semester
- bulk schedule publish
- archive automation אחרי סיום חלון
- תצוגת calendar של חלונות תרגילים
- preview as student מתוך builder
