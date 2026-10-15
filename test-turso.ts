import { db } from "./src/lib/db"; // تأكد أن المسار مطابق لمكان ملف الـ db عندك

async function main() {
  try {
    console.log("جاري اختبار الاتصال بقاعدة بيانات Turso...");

    // محاولة جلب البيانات من جدول الـ users (أو أي جدول موجود لديك)
    const users = await db.user.findMany();

    console.log("✅ الاتصال نجح! تم جلب المستخدمين بنجاح:");
    console.log(users);
  } catch (error) {
    console.error("❌ فشل الاتصال بقاعدة البيانات:", error);
  } finally {
    await db.$disconnect();
  }
}

main();