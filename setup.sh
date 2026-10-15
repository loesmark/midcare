#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#  MediCare — سكربت الإعداد والتشغيل السريع
#  يعمل على macOS / Linux / Git Bash (Windows)
# ═══════════════════════════════════════════════════════════
set -e

echo "🏥 MediCare — الإعداد والتشغيل"
echo "================================"

# التحقق من الأدوات المطلوبة
echo ""
echo "📋 [1/6] التحقق من الأدوات المطلوبة..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js غير مثبت. ثبّته من: https://nodejs.org"
  exit 1
fi
echo "  ✓ Node.js: $(node -v)"

if ! command -v bun &> /dev/null; then
  echo "❌ Bun غير مثبت. ثبّته من: https://bun.sh"
  exit 1
fi
echo "  ✓ Bun: $(bun -v)"

# التحقق من ملف .env
echo ""
echo "⚙️  [2/6] إعداد متغيرات البيئة..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ✓ تم إنشاء .env من .env.example"
  echo "  ⚠️  عدّل JWT_SECRET في .env لقيمة عشوائية (اختياري للتطوير المحلي)"
else
  echo "  ✓ .env موجود مسبقاً"
fi

# تثبيت الاعتمادات
echo ""
echo "📦 [3/6] تثبيت الاعتمادات..."
bun install
echo "  ✓ تم تثبيت كل الاعتمادات"

# إعداد قاعدة البيانات
echo ""
echo "🗄️  [4/6] إعداد قاعدة البيانات..."
bun run db:generate
bun run db:push
echo "  ✓ تم إنشاء جداول قاعدة البيانات"

# بيانات تجريبية
echo ""
echo "🌱 [5/6] ملء البيانات التجريبية..."
read -p "هل تريد ملء قاعدة البيانات ببيانات تجريبية؟ (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  bun run seed
  echo "  ✓ تم ملء البيانات التجريبية"
else
  echo "  ⏭️  تم تخطي البيانات التجريبية"
fi

# التشغيل
echo ""
echo "🚀 [6/6] تشغيل المشروع..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ اكتمل الإعداد!"
echo ""
echo "  📌 افتح المتصفح على: http://localhost:3000"
echo ""
echo "  🔑 بيانات الدخول:"
echo "     الهاتف:     01000000000"
echo "     كلمة المرور: admin123"
echo ""
echo "  لإيقاف السيرفر: اضغط Ctrl+C"
echo "═══════════════════════════════════════════════════════════"
echo ""

bun run dev
