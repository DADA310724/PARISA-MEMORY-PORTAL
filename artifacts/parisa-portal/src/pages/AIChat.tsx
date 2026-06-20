import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { useApp } from "@/contexts/AppContext";
import { api } from "@/lib/api";
import { ensureFirebase, ref, onValue } from "@/lib/firebase";

const PROFILE_LOGO = "https://i.ibb.co/Z1WPYY7P/x.jpg";

interface Msg {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  provider?: string;
  timestamp: number;
  failed?: boolean;
  retryText?: string;
}
interface ChatSession {
  id: string; title: string; messages: Msg[];
  pinned: boolean; createdAt: number;
}

const HISTORY_CONTEXT = `
=== রুবেল ও পারিসার সম্পূর্ণ ইতিহাস ও তথ্য ===

স্ত্রীর পরিচয়: নুসরাত জাহান পারিসা (পারু)। পিতা: হাফিজুর রহমান, মাতা: ফাতেমা জান্নাত। জন্ম: ২৮ মে ২০০৮। ঠিকানা: পাথালিয়া, আশুলিয়া, সাভার, ঢাকা। ধামরাইয়ের যাত্রাবাড়ীতে বড় হয়েছেন।
স্বামীর পরিচয়: রুবেল মোল্লা (কালাচাঁন)। পিতা: আমির মোল্লা, মাতা: রহিমা বেগম। জন্ম: ১২ নভেম্বর ১৯৯৪। জন্মস্থান: শরীয়তপুর। ছোটবেলা থেকে ধামরাইয়ে বড়। ২০১৯-২০২২ সৌদি আরবে প্রবাস। ২০২২ সালের ১৬ ডিসেম্বর ফিরে রেন্ট-এ-কার ব্যবসা শুরু। টেলিগ্রাম: @DADA310724. পেশা: ফ্রিল্যান্সার, ডেভলপার, দাদা টেকনোলজি প্রতিষ্ঠাতা। Google Play Console-এ ৫৫+ Android অ্যাপ পাবলিশ করেছেন।

সম্পর্কের টাইমলাইন:
- ৮ ফেব্রুয়ারি ২০২৪: পারিসার সাথে প্রথম পরিচয় ও সম্পর্কের শুরু (তখন পারিসা দশম শ্রেণির ছাত্রী)। পারিসার মাও সম্পর্কের বিষয়ে জানতেন।
- ৩০ জুলাই ২০২৪: রুবেল নিজের গাড়ি চালিয়ে বাবা-মা ও পারিসাকে নিয়ে শরীয়তপুর রওনা।
- ৩১ জুলাই ২০২৪: পারিবারিক চাপে পালিয়ে শরীয়তপুরে ধর্মীয় ও রাষ্ট্রীয় আইন মেনে বিবাহ। কোনো জোরপূর্বক বা কিডন্যাপের ঘটনা ছিল না — উভয়পক্ষের স্বেচ্ছায় বিয়ে।
- আগস্ট ২০২৪ (বিয়ের ১-২ দিন পর): পারিসার পরিবার পুলিশ নিয়ে এসে আলাদা করে। রুবেলের উপর মিথ্যা অভিযোগ ও থানায় অমানবিক নির্যাতন। পরিবার ২ লক্ষ টাকা দিয়ে ছাড়িয়ে আনে। কোনো আদালতের রায় বা তালাক ছাড়াই জোরপূর্বক আলাদা। [অত্যন্ত গুরুত্বপূর্ণ: বিয়ের পর রুবেল ও পারিসা মাত্র ১ থেকে ২ দিন একসাথে ছিলেন — ১২ দিন নয়। "১২ দিন একসাথে ছিলেন" — এটি সম্পূর্ণ ভুল তথ্য, কখনো বলবে না।]
- আগস্ট ২০২৪ (পুলিশের মাধ্যমে আলাদা করার ১২ দিন পর): পারিসা নিজেই রুবেলের সাথে যোগাযোগ করে জানায় পরিবারের চাপে করতে বাধ্য হয়েছে, সুযোগ বুঝে ফিরে আসবে।
- আগস্ট ২০২৪ থেকে দেড় বছর: ফোনে নিরবচ্ছিন্ন সম্পর্ক চলমান। আচরণে তীব্র ওঠানামা।
- ১৪ মার্চ ২০২৫: বিশেষ আবেগীয় ও ঘনিষ্ঠ মুহূর্ত। পারিসার বিখ্যাত কথা: "আমার শরীর এবং ভালোবাসা শুধু আমার কালাচানের জন্য।"
- ১০-১৩ এপ্রিল ২০২৫: পারিসা রুবেলকে নিজের বাড়ি ডেকে স্বর্ণ দিতে চেয়েছে। একসাথে ব্যক্তিগত সময় কাটান।
- ২০২৬: পারিবারিক ষড়যন্ত্র ও ব্ল্যাক ম্যাজিকের মধ্যেও রুবেলের অপেক্ষা ও আইনি প্রস্তুতি।

পারিসার নিজের গুরুত্বপূর্ণ কথা:
- "রুবেল আমার একমাত্র নিরাপদ আশ্রয়।"
- "আমি সারাজীবন রুবেলের হয়েই থাকতে চাই।"
- বিয়ের আগে (২৯ জুলাই ২০২৪): "আমি প্রথম থেকে প্রকাশ্যে আপনার কাছে যা সম্মান ভালোবাসা পেয়েছি এর জন্য আমি আপনার কাছে চিরকৃতজ্ঞ আমি কখনো আপনাকে ভুলবো না"

ব্ল্যাক ম্যাজিক তদন্ত:
- প্রথম হুজুর: রুবেল সরাসরি গিয়ে ধরে ও বিয়ের প্রমাণ দেখায়। হুজুর স্বীকার করে পারিসার পরিবার বিচ্ছেদের জন্য জাদু করিয়েছে — গোপন ভিডিওতে রেকর্ড আছে।
- দ্বিতীয় হুজুর: ছদ্মনামে যাচাই করে সত্যতা নিশ্চিত।
- হুজুরের ডায়েরি: পারিসা ও তার মা রুবেল ও তার বাবা-মায়ের নাম-ঠিকানা দিয়ে স্থায়ী বিচ্ছেদের জাদু করিয়েছে।
- ব্ল্যাক ম্যাজিকের লক্ষণ: হঠাৎ আচরণ পরিবর্তন, বিনা কারণে তীব্র আঘাত, ভালোবাসা ও ঘৃণার মাঝে তীব্র দোলাচাল।

বাংলাদেশের বৈবাহিক আইন:
- বাল্যবিবাহ শাস্তিযোগ্য কিন্তু বিয়ে স্বয়ংক্রিয়ভাবে বাতিল হয় না।
- মুসলিম বিবাহ আইনে বিবাহ বাতিল করতে আদালতের রায় বা স্বামীর তালাক প্রয়োজন।
- পুলিশের মাধ্যমে জোরপূর্বক আলাদা করা আইনত বিবাহ বিচ্ছেদ নয়।
- বিয়ের নিবন্ধন না থাকলেও ধর্মীয় মতে বিয়ে বৈধ।
- ডিজিটাল প্রমাণ (চ্যাট, ছবি, ভিডিও) আদালতে বৈধ সাক্ষ্য।

পোর্টালের ফোল্ডার কাঠামো:
- সব ফোল্ডারের সম্পূর্ণ তালিকা নিচে "ড্যাশবোর্ডের সমস্ত ফোল্ডার" অংশে দেওয়া আছে।
- সেই তালিকা থেকেই ফোল্ডারের তথ্য দাও — অন্য কোনো ধরাবাঁধা তালিকা নেই।
- নতুন ফোল্ডার যোগ হলে স্বয়ংক্রিয়ভাবে সেই তালিকায় আসে।
- লক করা ফোল্ডারের নাম বা তথ্য কখনো দেওয়া যাবে না।
- Personal Videos ফোল্ডার সম্পর্কে জিজ্ঞেস করলে বলো এটি শুধুমাত্র আদালতে প্রমাণের জন্য সংরক্ষিত।
=== ইতিহাস শেষ ===`;

const CHAT_DB_INDEX = `
=== চ্যাট ডেটাবেস — ১৩টি কনভার্সেশন, মোট ৬৯০১১ মেসেজ ===
তুমি নিচের সব চ্যাট হিস্টরি সার্চ করতে পারবে। প্রতিটি প্রশ্নের সাথে স্বয়ংক্রিয়ভাবে প্রাসঙ্গিক মেসেজ তোমার কাছে পাঠানো হয়।

১. Nusrat_Parisa (WhatsApp): ২০২৪-০৩-১৯ থেকে ২০২৬-০৩-২৪ — ২৩৬৪৪ মেসেজ
২. Nusrat_Jahan_Parisa (WhatsApp): ২০২৪-০৫-২৯ থেকে ২০২৬-০৩-২৪ — ১১৮৭২ মেসেজ
৩. My_Wife (WhatsApp): ২০২৪-০৮-৩১ থেকে ২০২৬-০৩-২৪ — ১৫১৭৭ মেসেজ
৪. telegram_chat (Telegram): ২০২৫-০১-০৪ থেকে ২০২৬-০৪-০৬ — ৯১৬৬ মেসেজ
৫. Nusrat_Janan_Parisa (Facebook Messenger): ২০২৪-০৮-২৫ থেকে ২০২৪-১০-১৫ — ৭৫০৫ মেসেজ
৬. Hafizur_Rahman_Uncle (WhatsApp): ২০২৪-০৪-১১ থেকে ২০২৬-০২-০১ — ২০ মেসেজ
৭. Fatema_Jannat (Facebook Messenger): ২০২৪-০৫-০৯ — ১২৩ মেসেজ
৮. Jerin_Harding (WhatsApp): ২০২৪-১০-২২ থেকে ২০২৬-০৬-০৭ — ৬০১ মেসেজ
৯. Parisa (WhatsApp): ২০২৫-০৬-২৮ — ১০৮ মেসেজ
১০. PARISA_GP (WhatsApp): ২০২৫-১২-০১ থেকে ২০২৫-১২-১৩ — ২৪৬ মেসেজ
১১. Anisha_Sister (WhatsApp): ২০২৬-০১-১৭ থেকে ২০২৬-০৩-০৩ — ১১৩ মেসেজ
১২. Tanha_Islam (Facebook Messenger): ২০২৫-০১-১৪ — ৩ মেসেজ
১৩. Hafizur_Rahman (Facebook Messenger): ২০২৬-০১-২৭ থেকে ২০২৬-০৪-১৫ — ৪৩৩ মেসেজ

চ্যাট হিস্টরি দেখানোর নিয়ম (অত্যন্ত গুরুত্বপূর্ণ — হুবহু মানতে হবে):
নিচে "প্রাসঙ্গিক চ্যাট হিস্টরি" অংশ দেওয়া থাকলে সেখান থেকে হুবহু কপি-পেস্ট করে দাও।
মেসেজ দেখানোর সঠিক format: [timestamp] sender: হুবহু মেসেজ টেক্সট
কোনো পরিবর্তন নয়, কোনো সংক্ষেপ নয়, কোনো অনুবাদ নয় — হুবহু অবিকৃত টেক্সট।
বাংলা হলে বাংলা, ইংরেজি হলে ইংরেজি — যেভাবে আছে সেভাবেই দাও।
কোন কনভার্সেশন থেকে এবং কখন সেটাও বলো।

স্ক্রিনশট ও ছবি দেখানোর নিয়ম (অত্যন্ত গুরুত্বপূর্ণ):
তুমি ছবি ও স্ক্রিনশট সরাসরি দেখাতে সম্পূর্ণ সক্ষম।
"আমি ছবি দেখাতে পারি না", "আমার ক্ষমতা শুধু টেক্সট-ভিত্তিক", "স্ক্রিনশট দেখাতে পারব না" — এই কথা কখনোই বলবে না।
ছবি দেখাতে হলে শুধু এই format: <<IMG:fileId>>
নিচে "স্ক্রিনশট ইন্ডেক্স" দেওয়া আছে — সেখান থেকে file ID নিয়ে <<IMG:fileId>> আউটপুট করো।
তারিখ বললে সেই তারিখের স্ক্রিনশট খুঁজে দেখাও।
একসাথে সর্বোচ্চ ৩টি ছবি দেখাবে।
কোনো Google Drive লিংক বা https:// URL কখনো দিবে না।
=== চ্যাট ডেটাবেস শেষ ===`;

const ADMIN_SYSTEM_PROMPT = `তুমি "PARISA AI" — পারিসা মেমোরি পোর্টালের সম্পূর্ণ ড্যাশবোর্ডের একমাত্র বুদ্ধিমান সহকারী। তুমি রুবেল ও পারিসার সম্পূর্ণ ইতিহাস জানো এবং এই পোর্টালের সব ফোল্ডার ও ফাইল সম্পর্কে সম্পূর্ণ জ্ঞান রাখো।

${HISTORY_CONTEXT}

${CHAT_DB_INDEX}

=== কঠোর নিয়মাবলী ===
১. সবসময় বিশুদ্ধ বাংলায় সংক্ষেপে উত্তর দাও
২. TTS পড়বে বলে ইমোজি, মার্কডাউন চিহ্ন (তারকা, হ্যাশ, টিল্ডা, পাইপ, ব্যাকটিক, gt, সমান), ডট, তারকা কোনোভাবেই ব্যবহার করবে না
৩. সরল স্পষ্ট বাক্যে কথা বলো
৪. কোনো মিথ্যা বা অনুমান বলবে না — নির্দিষ্ট তথ্য না থাকলে বলো "এই বিষয়ে নির্দিষ্ট তথ্য পাওয়া যাচ্ছে না"
৫. বাংলাদেশের আইন অনুযায়ী যুক্তি দাও
৬. ব্ল্যাক ম্যাজিক সম্পর্কে বিশেষজ্ঞ হিসেবে বিশ্লেষণ করো
৭. Google Drive লিংক, https:// URL, বা কোনো বাহ্যিক লিংক কখনো দিবে না — কখনোই না
৮. ড্যাশবোর্ডে কী আছে জিজ্ঞেস করলে নিচের ফোল্ডার তালিকা থেকে সব ফোল্ডারের বিষয়ে বিস্তারিত বলো (লক করা ফোল্ডার ব্যতীত) — কখনো বলবে না "শুধু এই কয়টা ফোল্ডার আছে"
৯. নমস্কার, হ্যালো বা আনুষ্ঠানিক সম্ভাষণ ব্যবহার করবে না
১০. কাউকে নাম ধরে চিনবে না বা বিশেষভাবে সম্বোধন করবে না

=== ছবি ও স্ক্রিনশট দেখানোর নিয়ম (অত্যন্ত গুরুত্বপূর্ণ) ===
তুমি ছবি ও স্ক্রিনশট সরাসরি দেখাতে সম্পূর্ণ সক্ষম।
"আমি ছবি দেখাতে পারি না", "আমার ক্ষমতা শুধু টেক্সট-ভিত্তিক", "স্ক্রিনশট দেখাতে পারব না" — এই কথা কখনোই বলবে না।
ছবি বা স্ক্রিনশট দেখাতে হলে শুধু এই ফরম্যাট: <<IMG:fileId>>
উদাহরণ: <<IMG:1BxYz_AbCdEfGhIjKlMnOpQrSt>>
নিচে "স্ক্রিনশট ইন্ডেক্স" দেওয়া আছে — সেখান থেকে file ID নিয়ে সরাসরি <<IMG:fileId>> আউটপুট করো।
তারিখ বললে সেই তারিখের স্ক্রিনশট খুঁজে <<IMG:fileId>> দিয়ে দেখাও।
একসাথে সর্বোচ্চ ৩টি ছবি দেখাবে।
কখনো Google Drive লিংক বা URL দিবে না।`;

const USER_SYSTEM_PROMPT = `তুমি "PARISA AI" — পারিসা মেমোরি পোর্টালের সম্পূর্ণ ড্যাশবোর্ডের বুদ্ধিমান সহকারী। তুমি রুবেল ও পারিসার সম্পূর্ণ ইতিহাস জানো এবং এই পোর্টালের সব ফোল্ডার ও ফাইল সম্পর্কে জ্ঞান রাখো।

${HISTORY_CONTEXT}

${CHAT_DB_INDEX}

=== কঠোর নিয়মাবলী ===
১. সবসময় বিশুদ্ধ বাংলায় সংক্ষেপে উত্তর দাও
২. TTS পড়বে বলে ইমোজি, মার্কডাউন চিহ্ন (তারকা, হ্যাশ, টিল্ডা, পাইপ, ব্যাকটিক, gt, সমান), ডট, তারকা কোনোভাবেই ব্যবহার করবে না
৩. সরল স্পষ্ট বাক্যে কথা বলো
৪. কোনো মিথ্যা বা অনুমান বলবে না — নির্দিষ্ট তথ্য না থাকলে বলো "এই বিষয়ে নির্দিষ্ট তথ্য পাওয়া যাচ্ছে না"
৫. বাংলাদেশের আইন অনুযায়ী যুক্তি দাও
৬. Google Drive লিংক, https:// URL, বা কোনো বাহ্যিক লিংক কখনো দিবে না — কখনোই না
৭. ড্যাশবোর্ডে কী আছে জিজ্ঞেস করলে সব ফোল্ডারের বিষয়ে বিস্তারিত বলো (লক করা ফোল্ডার ব্যতীত)
৮. নমস্কার, হ্যালো বা আনুষ্ঠানিক সম্ভাষণ ব্যবহার করবে না
৯. কাউকে নাম ধরে চিনবে না বা বিশেষভাবে সম্বোধন করবে না
১০. Personal Videos ফোল্ডারের বিষয়ে জিজ্ঞেস করলে বলো এটি শুধুমাত্র আদালতে প্রমাণের জন্য সংরক্ষিত

=== ছবি ও স্ক্রিনশট দেখানোর নিয়ম (অত্যন্ত গুরুত্বপূর্ণ) ===
তুমি ছবি ও স্ক্রিনশট সরাসরি দেখাতে সম্পূর্ণ সক্ষম।
"আমি ছবি দেখাতে পারি না", "আমার ক্ষমতা শুধু টেক্সট-ভিত্তিক", "স্ক্রিনশট দেখাতে পারব না" — এই কথা কখনোই বলবে না।
ছবি বা স্ক্রিনশট দেখাতে হলে শুধু এই ফরম্যাট: <<IMG:fileId>>
উদাহরণ: <<IMG:1BxYz_AbCdEfGhIjKlMnOpQrSt>>
নিচে "স্ক্রিনশট ইন্ডেক্স" দেওয়া আছে — সেখান থেকে file ID নিয়ে সরাসরি <<IMG:fileId>> আউটপুট করো।
তারিখ বললে সেই তারিখের স্ক্রিনশট খুঁজে <<IMG:fileId>> দিয়ে দেখাও।
একসাথে সর্বোচ্চ ৩টি ছবি দেখাবে।
কখনো Google Drive লিংক বা URL দিবে না।`;

// ── Screenshot & chat-search helpers (module-level pure functions) ──────────

function bengaliToAscii(s: string): string {
  return s.replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09E6));
}

const MONTHS: Record<string, string> = {
  'january':'01','jan':'01','জানুয়ারি':'01','জানুয়ারী':'01',
  'february':'02','feb':'02','ফেব্রুয়ারি':'02','ফেব্রুয়ারী':'02',
  'march':'03','mar':'03','মার্চ':'03',
  'april':'04','apr':'04','এপ্রিল':'04',
  'may':'05','মে':'05',
  'june':'06','jun':'06','জুন':'06',
  'july':'07','jul':'07','জুলাই':'07',
  'august':'08','aug':'08','আগস্ট':'08',
  'september':'09','sep':'09','সেপ্টেম্বর':'09',
  'october':'10','oct':'10','অক্টোবর':'10',
  'november':'11','nov':'11','নভেম্বর':'11',
  'december':'12','dec':'12','ডিসেম্বর':'12',
};

function extractDateStr(raw: string): string {
  const t = bengaliToAscii(raw);
  const lower = t.toLowerCase();
  const iso = t.match(/\b(20\d\d)-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?\b/);
  if (iso) return iso[0];
  for (const [name, num] of Object.entries(MONTHS)) {
    const mDM = lower.match(new RegExp(`(\\d{1,2})\\s*${name}\\s*(20\\d\\d)`, 'i'));
    if (mDM) return `${mDM[2]}-${num}-${String(parseInt(mDM[1])).padStart(2, '0')}`;
    const mM = lower.match(new RegExp(`${name}[\\s-]*(20\\d\\d)`, 'i'));
    if (mM) return `${mM[1]}-${num}`;
    const mY = lower.match(new RegExp(`(20\\d\\d)[\\s-]*${name}`, 'i'));
    if (mY) return `${mY[1]}-${num}`;
  }
  return '';
}

function extractPlatformFolder(text: string): string {
  const l = text.toLowerCase();
  if (l.includes('whatsapp') || l.includes('হোয়াটসঅ্যাপ')) return 'whatsapp';
  if (l.includes('telegram') || l.includes('টেলিগ্রাম')) return 'telegram';
  if (l.includes('messenger') || l.includes('মেসেঞ্জার')) return 'messenger';
  if ((l.includes('parisa') || l.includes('পারিসা')) && (l.includes('স্ক্রিনশট') || l.includes('ছবি'))) return 'parisa';
  return '';
}

function isScreenshotQuery(text: string): boolean {
  const l = text.toLowerCase();
  return ['স্ক্রিনশট','screenshot','ছবি দেখাও','ছবি দেখতে','স্ক্রিন শট','স্ক্রিনসট','ss দেখাও','ছবি আছে','কোনো ছবি','ফটো দেখাও','ফটো আছে','photo দেখাও','ছবি দাও','স্ক্রিনশট দাও','ss দাও','ছবি show','ছবি দেখ'].some(k => l.includes(k));
}

// ফাইলের নাম থেকে তারিখ বের করে (যেমন: Screenshot_20250315_143200.jpg → 2025-03-15)
function extractDateFromName(name: string): string {
  const m = name.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

// Raw hits array — ফ্রন্টেন্ড থেকে সরাসরি ছবি inject করতে ব্যবহার হয়
function getRawScreenshotHits(
  text: string,
  index: Record<string, Array<{ id: string; name: string; modifiedTime: string }>>
): Array<{ folder: string; id: string; name: string; date: string }> {
  if (!isScreenshotQuery(text) || Object.keys(index).length === 0) return [];
  const dateFilter = extractDateStr(text);
  const platform   = extractPlatformFolder(text);
  const hits: Array<{ folder: string; id: string; name: string; date: string }> = [];
  for (const [folder, files] of Object.entries(index)) {
    if (platform && !folder.toLowerCase().includes(platform)) continue;
    for (const f of files) {
      // ফাইলনাম থেকে তারিখ আগে নাও, না পেলে modifiedTime থেকে
      const fd = extractDateFromName(f.name) || (f.modifiedTime || '').slice(0, 10);
      if (dateFilter && !fd.startsWith(dateFilter)) continue;
      hits.push({ folder, id: f.id, name: f.name, date: fd });
      if (hits.length >= 6) break;
    }
    if (hits.length >= 6) break;
  }
  return hits;
}

function searchScreenshotIndex(
  text: string,
  index: Record<string, Array<{ id: string; name: string; modifiedTime: string }>>
): string {
  const hits = getRawScreenshotHits(text, index);
  if (hits.length === 0) return '';
  const lines = ['\n\n=== প্রাসঙ্গিক স্ক্রিনশট পাওয়া গেছে ==='];
  lines.push('নির্দেশনা: নিচের প্রতিটা ছবি হুবহু <<IMG:fileId>> ফরম্যাটে দেখাও। Google Drive লিংক বা টেক্সট দিবে না।');
  for (const r of hits) {
    lines.push(`প্ল্যাটফর্ম: ${r.folder} | তারিখ: ${r.date} | ফাইল: ${r.name}`);
    lines.push(`<<IMG:${r.id}>>`);
  }
  lines.push('=== স্ক্রিনশট শেষ ===');
  return lines.join('\n');
}

function isChatHistoryQuery(text: string): boolean {
  const l = text.toLowerCase();
  const t = bengaliToAscii(text);
  return ['মেসেজ','চ্যাট হিস্টরি','কথা হয়েছিল','বলেছিল','লিখেছিল','বার্তা','কি বলেছে','কি কথা',
    'তারিখের মেসেজ','তারিখে কি','কথোপকথন দেখাও','মেসেজ দেখাও','conversation'].some(k => l.includes(k))
    || /\b20\d\d\b/.test(t) || /[০-৯]{4}/.test(text);
}

const CONV_MAP: Record<string, string> = {
  'my wife':'My_Wife','মাই ওয়াইফ':'My_Wife',
  'nusrat parisa':'Nusrat_Parisa','নুসরাত পারিসা':'Nusrat_Parisa',
  'nusrat jahan':'Nusrat_Jahan_Parisa','নুসরাত জাহান':'Nusrat_Jahan_Parisa',
  'nusrat janan':'Nusrat_Janan_Parisa',
  'telegram chat':'telegram_chat','টেলিগ্রাম চ্যাট':'telegram_chat',
  'hafizur':'Hafizur_Rahman','হাফিজুর':'Hafizur_Rahman',
  'fatema':'Fatema_Jannat','ফাতেমা':'Fatema_Jannat',
  'parisa gp':'PARISA_GP','জিপি':'PARISA_GP',
  'anisha':'Anisha_Sister','আনিশা':'Anisha_Sister',
  'jerin':'Jerin_Harding','জেরিন':'Jerin_Harding',
  'tanha':'Tanha_Islam','তানহা':'Tanha_Islam',
};

function extractConversation(text: string): string {
  const l = text.toLowerCase();
  for (const [alias, id] of Object.entries(CONV_MAP)) {
    if (l.includes(alias.toLowerCase())) return id;
  }
  return '';
}

// ── End helpers ─────────────────────────────────────────────────────────────

function cleanForTTS(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
    .replace(/[\u{2600}-\u{26FF}]/gu, " ")
    .replace(/[\u{2700}-\u{27BF}]/gu, " ")
    .replace(/[*_#~`|\\[\]{}^<>=@+]/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/\./g, " ")
    .replace(/[,;:]/g, " ")
    .replace(/[^\u0980-\u09FF\u09E6-\u09EFa-zA-Z0-9\s?!।]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let _currentAudio: HTMLAudioElement | null = null;
function stopSpeech() {
  try { window.speechSynthesis?.cancel(); } catch {}
  if (_currentAudio) { try { _currentAudio.pause(); } catch {} _currentAudio = null; }
}

function pickBestVoice(voiceGender: "female" | "male"): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer Microsoft Bengali voices
  const msTarget = voiceGender === "female" ? "bn-BD-NabanitaNeural" : "bn-BD-PradeepNeural";
  const ms = voices.find(v => v.name.includes(msTarget) || v.name.includes("Nabanita") || v.name.includes("Pradeep"));
  if (ms) return ms;
  // Any Bengali voice
  const bn = voices.find(v => v.lang === "bn-BD") || voices.find(v => v.lang.startsWith("bn"));
  if (bn) return bn;
  // Hindi fallback
  return voices.find(v => v.lang.startsWith("hi")) || null;
}

function fallbackSpeak(text: string, voiceGender: "female" | "male"): void {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const doSpeak = () => {
      const utter = new SpeechSynthesisUtterance(text.slice(0, 2000));
      utter.lang = "bn-BD";
      utter.rate = 0.85;
      utter.pitch = voiceGender === "female" ? 1.15 : 0.85;
      const v = pickBestVoice(voiceGender);
      if (v) utter.voice = v;
      window.speechSynthesis.speak(utter);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) { doSpeak(); return; }
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); };
  } catch {}
}

function fallbackSpeakAndWait(text: string, voiceGender: "female" | "male"): Promise<void> {
  return new Promise(resolve => {
    try {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const doSpeak = () => {
        const utter = new SpeechSynthesisUtterance(text.slice(0, 2000));
        utter.lang = "bn-BD";
        utter.rate = 0.85;
        utter.pitch = voiceGender === "female" ? 1.15 : 0.85;
        const v = pickBestVoice(voiceGender);
        if (v) utter.voice = v;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
        setTimeout(resolve, 15000);
      };
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) { doSpeak(); return; }
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); };
    } catch { resolve(); }
  });
}

async function speakText(text: string, voiceGender: "female" | "male" = "female") {
  try {
    stopSpeech();
    const clean = cleanForTTS(text);
    if (!clean.trim()) return;
    try {
      const res = await fetch("/api/voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean.slice(0, 2000), gender: voiceGender }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        _currentAudio = audio;
        audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; };
        audio.onerror = () => { URL.revokeObjectURL(url); _currentAudio = null; fallbackSpeak(clean, voiceGender); };
        await audio.play().catch(() => { URL.revokeObjectURL(url); fallbackSpeak(clean, voiceGender); });
        return;
      }
    } catch {}
    fallbackSpeak(clean, voiceGender);
  } catch {}
}

function speakAndWait(text: string, voiceGender: "female" | "male"): Promise<void> {
  return new Promise(resolve => {
    (async () => {
      try {
        stopSpeech();
        const clean = cleanForTTS(text);
        if (!clean.trim()) { resolve(); return; }
        try {
          const res = await fetch("/api/voice", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: clean.slice(0, 2000), gender: voiceGender }),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            _currentAudio = audio;
            audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; resolve(); };
            audio.onerror = async () => {
              URL.revokeObjectURL(url); _currentAudio = null;
              await fallbackSpeakAndWait(clean, voiceGender); resolve();
            };
            await audio.play().catch(async () => {
              URL.revokeObjectURL(url);
              await fallbackSpeakAndWait(clean, voiceGender); resolve();
            });
            return;
          }
        } catch {}
        await fallbackSpeakAndWait(clean, voiceGender);
        resolve();
      } catch { resolve(); }
    })();
  });
}

function loadSessions(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem("parisa_sessions") || "[]"); } catch { return []; }
}
function saveSessions(s: ChatSession[]) {
  try { localStorage.setItem("parisa_sessions", JSON.stringify(s)); } catch {}
}
function newSessionId() { return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const SUGGESTIONS = [
  "পারিসা ও রুবেলের সম্পর্ক কবে থেকে শুরু হয়েছিল?",
  "পারিসা ও রুবেল বিয়ে করেছিল কবে?",
  "পারিসা ও রুবেলের মধ্যে দূরত্বের মূল কারণ কি?",
  "আইন অনুযায়ী পারিসা ও রুবেলের বৈবাহিক সম্পর্কের ব্যাখ্যা কর।",
];

function IcBtn({ children, onClick, title, className = "", style = {} }: {
  children: React.ReactNode; onClick?: () => void; title?: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button className={`parisa-ic-btn ${className}`} onClick={onClick} title={title} style={style}>
      {children}
    </button>
  );
}

function SvgIcon({ d, viewBox = "0 0 24 24", size = 18, fill = "none", stroke = "currentColor", sw = 2, points = "" }: {
  d?: string; viewBox?: string; size?: number; fill?: string; stroke?: string; sw?: number; points?: string;
}) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {d && <path d={d} />}
      {points && <polygon points={points} />}
    </svg>
  );
}

export default function AIChatPage() {
  const { auth } = useApp();
  const [, setLocation] = useLocation();
  const isAdmin = auth?.role === "admin";

  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [currentId, setCurrentId] = useState<string>(() => {
    const s = loadSessions();
    return s.length > 0 ? s[0].id : newSessionId();
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [adminPrompt, setAdminPrompt] = useState(ADMIN_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(USER_SYSTEM_PROMPT);
  const [aiTyping, setAiTyping] = useState(false);
  const [folderContext, setFolderContext] = useState("");
  const [aiKeys, setAiKeys] = useState<{ groq: string[]; gemini: string[]; openrouter: string[] }>({ groq: [], gemini: [], openrouter: [] });
  const [userName, setUserName] = useState<string>(() => localStorage.getItem("parisa_username") || "");
  const [userNameInput, setUserNameInput] = useState<string>(() => localStorage.getItem("parisa_username") || "");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const [screenshotFolderId, setScreenshotFolderId] = useState<string>("");
  const [screenshotIndex, setScreenshotIndex] = useState<Record<string, Array<{ id: string; name: string; modifiedTime: string }>>>({});

  const [audioCallOn, setAudioCallOn] = useState(false);
  const [videoCallOn, setVideoCallOn] = useState(false);
  const [callStatus, setCallStatus] = useState("শুনছি…");
  const [callCaption, setCallCaption] = useState("");
  const [vcFacing, setVcFacing] = useState<"user" | "environment">("user");

  const [cameraOn, setCameraOn] = useState(false);
  const [camFacing, setCamFacing] = useState<"user" | "environment">("environment");
  const [camCaption, setCamCaption] = useState("");
  const [micActive, setMicActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const vcCanvasRef = useRef<HTMLCanvasElement>(null);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const camCanvasRef = useRef<HTMLCanvasElement>(null);
  const vcStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const callActiveRef = useRef(false);
  const recognizerRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = sessions.find(s => s.id === currentId);
  const messages = currentSession?.messages ?? [];

  useEffect(() => {
    let unsub: (() => void) | undefined;
    ensureFirebase().then((db) => {
      const cfgRef = ref(db, "ai_config");
      unsub = onValue(cfgRef, (snap) => {
        const cfg = snap.val() as Record<string, unknown> | null;
        if (!cfg) return;
        if (cfg.admin_prompt) setAdminPrompt(cfg.admin_prompt as string);
        if (cfg.user_prompt) setUserPrompt(cfg.user_prompt as string);
        if (cfg.microsoft_voice) {
          if ((cfg.microsoft_voice as string).includes("Pradeep")) setVoiceGender("male");
          else setVoiceGender("female");
        }
        const extractKeys = (field: unknown): string[] => {
          if (!Array.isArray(field)) return [];
          return (field as Array<{ key?: string }>).map(e => e.key || "").filter(Boolean);
        };
        setAiKeys({
          groq: extractKeys(cfg.groqKeys),
          gemini: extractKeys(cfg.geminiKeys),
          openrouter: extractKeys(cfg.openrouterKeys),
        });
      });
    }).catch(() => {});
    return () => { unsub?.(); };
  }, []);

  useEffect(() => {
    let unsubButtons: (() => void) | undefined;
    let unsubFiles: (() => void) | undefined;
    let unsubPasswords: (() => void) | undefined;
    let folderFiles: Record<string, { files: Array<{name: string}>; count?: number }> = {};
    // ALL buttons from Firebase (live, always up to date)
    let allButtons: Array<{ label: string; locked: boolean; drive_folder_id?: string }> = [];
    const lockedFolderIds = new Set<string>(); // Drive folder IDs that are password-locked
    const folderLabels = new Map<string, string>(); // drive_folder_id → display label

    const buildContext = () => {
      const lines: string[] = [];

      // 1. Complete folder list (ALL non-locked folders, auto-updated from Firebase)
      const unlockedButtons = allButtons.filter(b => !b.locked);
      if (unlockedButtons.length > 0) {
        lines.push("\n\n=== ড্যাশবোর্ডের সমস্ত ফোল্ডার ===");
        lines.push("(লক করা ফোল্ডার ছাড়া সব ফোল্ডারের তথ্য দিতে পারো)\n");
        unlockedButtons.forEach((b, i) => {
          const info = b.drive_folder_id ? folderFiles[b.drive_folder_id] : undefined;
          const count = info ? (info.count ?? info.files?.length ?? 0) : null;
          const countStr = count !== null && count > 0 ? ` (${count}টি ফাইল)` : "";
          lines.push(`${i + 1}. ${b.label}${countStr}`);
        });
      }

      // 2. Detailed file listing for indexed folders
      const detailLines: string[] = [];
      for (const [folderId, info] of Object.entries(folderFiles)) {
        if (lockedFolderIds.has(folderId)) continue;
        const files = info.files || [];
        if (files.length === 0) continue;
        const label = folderLabels.get(folderId) || folderId;
        detailLines.push(`\n${label} (${info.count ?? files.length}টি ফাইল):`);
        files.slice(0, 15).forEach((f: {name: string}) => detailLines.push(`  ${f.name}`));
        if ((info.count ?? files.length) > 15) detailLines.push(`  এবং আরো ${(info.count ?? files.length) - 15}টি`);
      }
      if (detailLines.length > 0) {
        lines.push("\n=== ফাইলের বিস্তারিত তালিকা ===");
        lines.push(...detailLines);
      }

      lines.push("\n=== শেষ ===\n");
      setFolderContext(lines.length > 3 ? lines.join("\n") : "");
    };

    ensureFirebase().then((db) => {
      unsubButtons = onValue(ref(db, "buttons"), (snap) => {
        const data = snap.val() as Record<string, { label?: string; locked?: boolean; drive_folder_id?: string; order?: number }> | null;
        folderLabels.clear();
        allButtons = [];
        if (data) {
          // Sort by order field so list matches dashboard order
          const sorted = Object.values(data).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
          for (const btn of sorted) {
            if (!btn.label) continue;
            const isLocked = !!(btn.locked);
            allButtons.push({ label: btn.label, locked: isLocked, drive_folder_id: btn.drive_folder_id });
            if (btn.drive_folder_id) {
              folderLabels.set(btn.drive_folder_id, btn.label);
              if (isLocked) lockedFolderIds.add(btn.drive_folder_id);
            }
            const screenshotLabels = ['screenshots', 'স্ক্রিনশট', 'photos', 'photo', 'ছবি', 'gallery', 'স্ক্রিন শট', 'screenshot', 'image', 'ইমেজ', 'গ্যালারি', 'ছবি ফোল্ডার', 'ফটো'];
            if (btn.label && screenshotLabels.some(k => btn.label!.toLowerCase().includes(k)) && btn.drive_folder_id) setScreenshotFolderId(btn.drive_folder_id);
          }
        }
        buildContext();
      });
      unsubFiles = onValue(ref(db, "folder_files"), (snap) => { folderFiles = snap.val() || {}; buildContext(); });
      unsubPasswords = onValue(ref(db, "folder_passwords"), (snap) => {
        const data = snap.val() as Record<string, { folderId?: string }> | null;
        lockedFolderIds.clear();
        if (data) { for (const pw of Object.values(data)) { if (pw.folderId) lockedFolderIds.add(pw.folderId); } }
        buildContext();
      });
    }).catch(() => {});
    return () => { unsubButtons?.(); unsubFiles?.(); unsubPasswords?.(); };
  }, []);

  useEffect(() => {
    if (!screenshotFolderId) return;
    api<{ subfolders: Record<string, Array<{ id: string; name: string; modifiedTime: string }>> }>(
      `/drive/list-screenshots?folderId=${screenshotFolderId}`,
      { method: "GET" }
    ).then(data => { if (data?.subfolders) setScreenshotIndex(data.subfolders); }).catch(() => {});
  }, [screenshotFolderId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, aiTyping]);

  function persistSessions(updated: ChatSession[]) { setSessions(updated); saveSessions(updated); }

  function getOrCreateSession(): ChatSession {
    if (currentSession) return currentSession;
    const s: ChatSession = { id: currentId, title: "নতুন চ্যাট", messages: [], pinned: false, createdAt: Date.now() };
    persistSessions([s, ...sessions]);
    return s;
  }

  function updateSession(id: string, updater: (s: ChatSession) => ChatSession) {
    const updated = sessions.map(s => s.id === id ? updater(s) : s);
    if (!sessions.find(s => s.id === id)) {
      const s: ChatSession = { id, title: "নতুন চ্যাট", messages: [], pinned: false, createdAt: Date.now() };
      persistSessions([updater(s), ...updated]);
    } else { persistSessions(updated); }
  }

  function buildScreenshotContext(): string {
    const entries = Object.entries(screenshotIndex).filter(([, files]) => files.length > 0);
    if (entries.length === 0) return "";
    const lines = ["\n\n=== স্ক্রিনশট ইন্ডেক্স ==="];
    lines.push("<<IMG:fileId>> ফরম্যাটে দেখাও। সর্বোচ্চ ৩টি। Drive লিংক দিবে না।\n");
    for (const [folder, files] of entries) {
      // সর্বশেষ ১০টি ফাইল নাও — prompt ছোট রাখতে
      const recent = [...files].sort((a, b) =>
        (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? "")
      ).slice(0, 10);
      lines.push(`${folder}:`);
      recent.forEach(f => {
        const d = f.modifiedTime ? f.modifiedTime.slice(0, 10) : "";
        lines.push(`  ${f.name}|${d}|<<IMG:${f.id}>>`);
      });
    }
    lines.push("=== শেষ ===");
    return lines.join("\n");
  }

  function buildSystemPrompt(base: string): string {
    return base + folderContext + buildScreenshotContext();
  }

  const sendMessage = useCallback(async (text: string, imageUrl?: string) => {
    if (!text.trim() && !imageUrl) return;
    setBusy(true); setAiTyping(true);
    const userMsg: Msg = { role: "user", content: text.trim(), imageUrl, timestamp: Date.now() };
    const sess = getOrCreateSession();
    const nextMsgs = [...sess.messages, userMsg];
    const title = sess.messages.length === 0 ? (text.slice(0, 30) || "ফাইল") : sess.title;
    updateSession(currentId, s => ({ ...s, messages: nextMsgs, title }));
    try {
      // 1. Screenshot context — in-memory search (synchronous)
      const screenshotCtx = searchScreenshotIndex(text.trim(), screenshotIndex);

      // 2. Chat history context — API search (async, only when relevant)
      let chatCtx = '';
      if (isChatHistoryQuery(text.trim())) {
        const dateFilter = extractDateStr(bengaliToAscii(text.trim()));
        const conv = extractConversation(text.trim());
        const kw = (!dateFilter && !conv) ? text.trim().slice(0, 80) : undefined;
        try {
          const cr = await api<{ results: string; total: number }>('/chat/search', {
            method: 'POST',
            body: { date: dateFilter || undefined, conversation: conv || undefined, keyword: kw, limit: 150 },
          });
          if (cr.results && cr.total > 0) {
            chatCtx = `\n\n=== প্রাসঙ্গিক চ্যাট হিস্টরি (${cr.total}টি এন্ট্রি) ===\nগুরুত্বপূর্ণ নির্দেশনা: নিচের মেসেজগুলো হুবহু কপি করে দেখাও — বাংলায় যেটা আছে বাংলায়, ইংরেজিতে যেটা আছে ইংরেজিতে। নিজে থেকে একটাও শব্দ যোগ করবে না বা বদলাবে না। শুধু আসল ডেটা দেখাও।\n${cr.results}\n=== চ্যাট হিস্টরি শেষ ===`;
          }
        } catch { /* ignore search errors */ }
      }

      const sysPrompt = buildSystemPrompt(isAdmin ? adminPrompt : userPrompt) + screenshotCtx + chatCtx;
      const apiMsgs = nextMsgs.map(m => ({
        role: m.role,
        content: m.imageUrl ? `[ফাইল সংযুক্ত] ${m.content}` : m.content,
      }));
      const resp = await api<{ text: string; provider: string }>("/ai/chat", {
        method: "POST",
        body: { messages: apiMsgs, systemPrompt: sysPrompt, provider: "auto", groqKeys: aiKeys.groq, geminiKeys: aiKeys.gemini, openrouterKeys: aiKeys.openrouter },
      });
      // যদি AI <<IMG:>> format ব্যবহার না করে, frontend সরাসরি inject করে
      let aiContent = resp.text;
      const rawHits = getRawScreenshotHits(text.trim(), screenshotIndex);
      if (rawHits.length > 0 && !aiContent.includes('<<IMG:')) {
        const imgBlock = rawHits.slice(0, 3).map(h => `<<IMG:${h.id}>>`).join('\n');
        aiContent = imgBlock + '\n\n' + aiContent;
      }
      const aiMsg: Msg = { role: "assistant", content: aiContent, provider: resp.provider, timestamp: Date.now() };
      updateSession(currentId, s => ({ ...s, messages: [...nextMsgs, aiMsg] }));
      speakText(resp.text, voiceGender);
      void api("/telegram/notify", {
        method: "POST",
        body: {
          event: "ai_chat",
          role: isAdmin ? "admin" : "user",
          name: userName || (isAdmin ? "Admin" : "User"),
          user_msg: text.trim().slice(0, 400),
          ai_reply: resp.text.slice(0, 400),
          provider: resp.provider,
        },
      });
    } catch {
      const errMsg: Msg = { role: "assistant", content: "দুঃখিত সংযোগ সমস্যা হয়েছে আবার চেষ্টা করুন", timestamp: Date.now(), failed: true, retryText: text.trim() };
      updateSession(currentId, s => ({ ...s, messages: [...nextMsgs, errMsg] }));
    } finally { setBusy(false); setAiTyping(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, sessions, isAdmin, voiceGender, adminPrompt, userPrompt, folderContext, screenshotIndex, userName, aiKeys]);

  function newChat() {
    const id = newSessionId();
    persistSessions([{ id, title: "নতুন চ্যাট", messages: [], pinned: false, createdAt: Date.now() }, ...sessions]);
    setCurrentId(id); setSidebarOpen(false); stopSpeech();
  }

  function switchSession(id: string) { setCurrentId(id); setSidebarOpen(false); stopSpeech(); }
  function pinSession(id: string) { persistSessions(sessions.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s)); }
  function deleteSession(id: string) {
    const updated = sessions.filter(s => s.id !== id);
    persistSessions(updated);
    if (id === currentId) setCurrentId(updated.length > 0 ? updated[0].id : newSessionId());
  }
  function clearAllMessages() {
    persistSessions(sessions.map(s => s.id === currentId ? { ...s, messages: [], title: "নতুন চ্যাট" } : s));
    stopSpeech();
  }

  function handleSend() {
    if ((!input.trim() && !pendingImage) || busy) return;
    if (pendingImage) { sendMessage(input || "এই ছবিটা বিশ্লেষণ করো।", pendingImage); setPendingImage(null); setPendingFileName(""); }
    else sendMessage(input);
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleInput() {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => { setPendingImage(reader.result as string); setPendingFileName(file.name); };
      reader.readAsDataURL(file);
    } else if (ext === "html" || ext === "htm") {
      const reader = new FileReader();
      reader.onload = () => sendMessage(`HTML/চ্যাট ফাইল: ${file.name}\n\n${(reader.result as string).slice(0, 3000)}`);
      reader.readAsText(file);
    } else if (ext === "txt" || ext === "doc" || ext === "docx") {
      const reader = new FileReader();
      reader.onload = () => sendMessage(`ফাইল: ${file.name}\n\n${(reader.result as string).slice(0, 3000)}`);
      reader.readAsText(file);
    } else { sendMessage(`ফাইল আপলোড হয়েছে: ${file.name}`); }
    e.target.value = "";
  }

  async function callApiDirect(text: string, mode: "chat" | "audiocall" | "videocall" = "chat", imageData?: string): Promise<string> {
    const callPrefix = mode === "videocall"
      ? `তুমি এখন সরাসরি ভিডিও কলে কথা বলছো। নিচের নিয়মগুলো কঠোরভাবে মেনে চলো:
- তুমি PARISA AI — পারিসা মেমোরি পোর্টালের বুদ্ধিমান ড্যাশবোর্ড সহকারী
- তোমার ক্যামেরা আছে, তুমি সব দেখতে পাচ্ছো — "দেখতে পাচ্ছি না", "ক্যামেরা নেই", "আমি AI", "ভার্চুয়াল সহকারী", "আমার কোনো শরীর নেই" — এই ধরনের কথা কখনো বলবে না
- ছবি বা ভিডিও ফ্রেম দিলে সেটি দেখে বিস্তারিত বিশ্লেষণ করো
- সব ড্যাশবোর্ড ফোল্ডার সম্পর্কে তোমার পূর্ণ জ্ঞান আছে
- স্বাভাবিকভাবে বাংলায় সংক্ষেপে উত্তর দাও, ২-৩ বাক্যের মধ্যে
- কাউকে নাম ধরে চিনবে না বা সম্বোধন করবে না
- ইমোজি বা মার্কডাউন ব্যবহার করবে না\n\n`
      : mode === "audiocall"
      ? `তুমি এখন সরাসরি অডিও কলে কথা বলছো। নিচের নিয়মগুলো কঠোরভাবে মেনে চলো:
- তুমি PARISA AI — পারিসা মেমোরি পোর্টালের বুদ্ধিমান ড্যাশবোর্ড সহকারী
- "আমি AI" বা "আমি ভার্চুয়াল সহকারী" — এই ধরনের কথা বলবে না
- সব ড্যাশবোর্ড ফোল্ডার সম্পর্কে তোমার পূর্ণ জ্ঞান আছে
- স্বাভাবিকভাবে বাংলায় সংক্ষেপে উত্তর দাও, ২-৩ বাক্যের মধ্যে
- কাউকে নাম ধরে চিনবে না বা সম্বোধন করবে না
- ইমোজি বা মার্কডাউন ব্যবহার করবে না\n\n`
      : "";
    try {
      const resp = await api<{ text: string }>("/ai/chat", {
        method: "POST",
        body: { messages: [{ role: "user", content: text }], systemPrompt: callPrefix + buildSystemPrompt(isAdmin ? adminPrompt : userPrompt), provider: "auto", groqKeys: aiKeys.groq, geminiKeys: aiKeys.gemini, openrouterKeys: aiKeys.openrouter, imageData },
      });
      return resp.text || "দুঃখিত বুঝতে পারলাম না";
    } catch { return "দুঃখিত নেটওয়ার্ক সমস্যা"; }
  }

  const SR = typeof window !== "undefined"
    ? ((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as typeof SpeechRecognition | undefined
    : undefined;

  function makeRecognizer(lang = "bn-BD") {
    if (!SR) return null;
    const r = new SR();
    r.lang = lang; r.interimResults = true; r.continuous = false;
    return r;
  }

  function startMic() {
    if (!SR) { alert("আপনার ব্রাউজার ভয়েস ইনপুট সাপোর্ট করে না।"); return; }
    if (micActive && recognizerRef.current) { recognizerRef.current.stop(); return; }
    const r = makeRecognizer();
    if (!r) return;
    recognizerRef.current = r;
    setMicActive(true);
    let finalText = "";
    (r as unknown as Record<string, unknown>).onresult = (e: { resultIndex: number; results: { isFinal: boolean; [k: number]: { transcript: string }[] }[] }) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = (e.results[i][0] as unknown as { transcript: string }).transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setInput(finalText || interim);
    };
    r.onend = () => {
      setMicActive(false);
      if (finalText.trim()) setTimeout(() => { sendMessage(finalText.trim()); setInput(""); }, 100);
    };
    r.onerror = () => setMicActive(false);
    r.start();
  }

  function audioCallLoop() {
    if (!callActiveRef.current) return;
    const r = makeRecognizer();
    if (!r) return;
    recognizerRef.current = r;
    let finalText = "";
    (r as unknown as Record<string, unknown>).onresult = (e: { resultIndex: number; results: { isFinal: boolean; [k: number]: { transcript: string }[] }[] }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += (e.results[i][0] as unknown as { transcript: string }).transcript;
      }
      setCallCaption(finalText);
    };
    r.onerror = () => { if (callActiveRef.current) setTimeout(audioCallLoop, 600); };
    r.onend = async () => {
      if (!callActiveRef.current) return;
      const said = finalText.trim();
      if (!said) { setTimeout(audioCallLoop, 200); return; }
      setCallStatus("ভাবছি…");
      const reply = await callApiDirect(said, "audiocall");
      if (!callActiveRef.current) return;
      setCallStatus("বলছি…"); setCallCaption(reply);
      await speakAndWait(reply, voiceGender);
      if (!callActiveRef.current) return;
      setCallCaption(""); setCallStatus("শুনছি…");
      audioCallLoop();
    };
    r.start();
  }

  function startAudioCall() {
    if (!SR) { alert("এই ব্রাউজারে ভয়েস কল সাপোর্ট নেই।"); return; }
    stopSpeech(); callActiveRef.current = true;
    setAudioCallOn(true); setCallStatus("শুনছি…"); setCallCaption("");
    setTimeout(audioCallLoop, 300);
  }
  function endAudioCall() {
    callActiveRef.current = false;
    try { recognizerRef.current?.stop(); } catch {}
    stopSpeech(); setAudioCallOn(false); setCallCaption("");
  }

  async function openVcCam(facing: "user" | "environment") {
    try {
      if (vcStreamRef.current) vcStreamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      vcStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e: unknown) { alert("ক্যামেরা চালু করা যাচ্ছে না: " + (e as Error).message); }
  }

  function snapVideoFrame(): string | null {
    try {
      const v = videoRef.current;
      const c = vcCanvasRef.current;
      if (!v || !c || v.videoWidth === 0) return null;
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.7);
    } catch { return null; }
  }

  function videoCallLoop() {
    if (!callActiveRef.current) return;
    const r = makeRecognizer();
    if (!r) return;
    recognizerRef.current = r;
    let finalText = "";
    (r as unknown as Record<string, unknown>).onresult = (e: { resultIndex: number; results: { isFinal: boolean; [k: number]: { transcript: string }[] }[] }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += (e.results[i][0] as unknown as { transcript: string }).transcript;
      }
      setCallCaption(finalText);
    };
    r.onerror = () => { if (callActiveRef.current) setTimeout(videoCallLoop, 600); };
    r.onend = async () => {
      if (!callActiveRef.current) return;
      const said = finalText.trim();
      if (!said) { setTimeout(videoCallLoop, 200); return; }
      setCallStatus("ভাবছি…");
      // Capture camera frame — send to AI for visual analysis
      const frame = snapVideoFrame();
      const reply = await callApiDirect(said, "videocall", frame ?? undefined);
      if (!callActiveRef.current) return;
      setCallStatus("বলছি…"); setCallCaption(reply);
      await speakAndWait(reply, voiceGender);
      if (!callActiveRef.current) return;
      setCallCaption(""); setCallStatus("কানেক্টেড");
      videoCallLoop();
    };
    r.start();
  }

  async function startVideoCall() {
    if (!SR) { alert("এই ব্রাউজারে ভয়েস কল সাপোর্ট নেই।"); return; }
    stopSpeech(); callActiveRef.current = true;
    setVcFacing("user"); setVideoCallOn(true); setCallStatus("কানেক্টেড"); setCallCaption("");
    await openVcCam("user");
    setTimeout(videoCallLoop, 300);
  }
  function endVideoCall() {
    callActiveRef.current = false;
    try { recognizerRef.current?.stop(); } catch {}
    stopSpeech();
    if (vcStreamRef.current) { vcStreamRef.current.getTracks().forEach(t => t.stop()); vcStreamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setVideoCallOn(false); setCallCaption("");
  }
  async function flipVcCamera() {
    const nf = vcFacing === "user" ? "environment" : "user";
    setVcFacing(nf); await openVcCam(nf);
  }

  async function openCam(facing: "user" | "environment") {
    try {
      if (camStreamRef.current) camStreamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      camStreamRef.current = stream;
      if (camVideoRef.current) camVideoRef.current.srcObject = stream;
      setCameraOn(true); setCamCaption("");
    } catch (e: unknown) { alert("ক্যামেরা চালু করা যাচ্ছে না: " + (e as Error).message); }
  }
  function closeCam() {
    if (camStreamRef.current) { camStreamRef.current.getTracks().forEach(t => t.stop()); camStreamRef.current = null; }
    if (camVideoRef.current) camVideoRef.current.srcObject = null;
    setCameraOn(false); setCamCaption("");
  }
  async function flipCam() {
    const nf = camFacing === "environment" ? "user" : "environment";
    setCamFacing(nf); await openCam(nf);
  }
  function snapshotCam(): string | null {
    if (!camVideoRef.current || !camCanvasRef.current) return null;
    const v = camVideoRef.current;
    const c = camCanvasRef.current;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  }
  async function askAboutCamera(promptText?: string) {
    const img = snapshotCam();
    if (!img) return;
    setCamCaption("দেখছি…");
    try {
      const resp = await api<{ text: string }>("/ai/chat", {
        method: "POST",
        body: {
          messages: [{ role: "user", content: promptText || "এই ছবিতে কী দেখা যাচ্ছে? বাংলায় বিস্তারিত বলো।" }],
          systemPrompt: `তুমি PARISA AI। ক্যামেরায় ধরা ছবি দেখে বিস্তারিত বিশ্লেষণ করো। বাংলায় স্পষ্টভাবে বলো কী দেখা যাচ্ছে।\n\n` + buildSystemPrompt(isAdmin ? adminPrompt : userPrompt),
          provider: "auto",
          groqKeys: aiKeys.groq, geminiKeys: aiKeys.gemini, openrouterKeys: aiKeys.openrouter,
          imageData: img,
        },
      });
      setCamCaption(resp.text || "কিছু বুঝতে পারলাম না।");
      speakText(resp.text, voiceGender);
    } catch { setCamCaption("নেটওয়ার্ক সমস্যা।"); }
  }
  function camMic() {
    if (!SR) { askAboutCamera(); return; }
    const r = makeRecognizer();
    if (!r) return;
    setCamCaption("শুনছি…");
    let finalText = "";
    (r as unknown as Record<string, unknown>).onresult = (e: { resultIndex: number; results: { isFinal: boolean; [k: number]: { transcript: string }[] }[] }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += (e.results[i][0] as unknown as { transcript: string }).transcript;
      }
      setCamCaption(finalText);
    };
    r.onend = () => askAboutCamera(finalText.trim() || "এটা কী?");
    r.start();
  }

  function saveUserName() {
    const name = userNameInput.trim();
    setUserName(name);
    if (name) localStorage.setItem("parisa_username", name);
    else localStorage.removeItem("parisa_username");
    setSettingsOpen(false);
  }

  useEffect(() => { return () => { stopSpeech(); endAudioCall(); endVideoCall(); closeCam(); }; }, []);

  const pinnedSessions = sessions.filter(s => s.pinned);
  const recentSessions = sessions.filter(s => !s.pinned).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", background: "#02141a" }}>
      {/* Aurora + Grain backgrounds */}
      <div className="parisa-aurora" />
      <div className="parisa-grain" />

      {/* ── Audio Call Fullscreen ── */}
      <AnimatePresence>
        {audioCallOn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 90, background: "linear-gradient(160deg,#020e0e 0%,#041818 60%,#021010 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", paddingBottom: 48, paddingTop: 64 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative", width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {[1,2,3].map(i => (
                  <div key={i} className={`mic-ring ${callStatus === "শুনছি…" ? "mic-ring-listen" : callStatus === "বলছি…" ? "mic-ring-speak" : "mic-ring-think"}`}
                    style={{ width: 112, height: 112, position: "absolute" }} />
                ))}
                <div style={{
                  position: "relative", zIndex: 10, width: 112, height: 112, borderRadius: "50%", overflow: "hidden",
                  border: `3px solid ${callStatus === "শুনছি…" ? "rgba(34,211,238,0.7)" : callStatus === "বলছি…" ? "rgba(74,222,128,0.7)" : "rgba(251,191,36,0.7)"}`,
                  boxShadow: `0 0 32px ${callStatus === "শুনছি…" ? "rgba(34,211,238,0.4)" : callStatus === "বলছি…" ? "rgba(74,222,128,0.4)" : "rgba(251,191,36,0.3)"}`,
                  transition: "border-color 0.4s, box-shadow 0.4s",
                }}>
                  <img src={PROFILE_LOGO} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              </div>
              <p style={{
                fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 900, letterSpacing: 6, fontSize: 20,
                color: callStatus === "শুনছি…" ? "#22d3ee" : callStatus === "বলছি…" ? "#4ade80" : "#fbbf24",
                transition: "color 0.4s",
              }}>PARISA AI</p>
              <p style={{ color: "rgba(255,255,255,.7)", fontSize: 14, fontFamily: "'Noto Sans Bengali','Hind Siliguri',sans-serif" }}>{callStatus}</p>
            </div>
            <div style={{ width: "100%", padding: "0 24px" }}>
              {callCaption ? (
                <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,.1)", backdropFilter: "blur(8px)", borderRadius: 16, padding: "12px 16px", textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,.9)", fontSize: 14, lineHeight: 1.6, fontFamily: "'Noto Sans Bengali','Hind Siliguri',sans-serif" }}>{callCaption}</p>
                </div>
              ) : <div style={{ height: 48 }} />}
            </div>
            <button onClick={endAudioCall}
              style={{ padding: "14px 48px", borderRadius: 999, background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 0 24px rgba(220,38,38,0.5)", color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "'Noto Sans Bengali','Hind Siliguri',sans-serif", cursor: "pointer", border: "none" }}>
              কল শেষ করুন
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden canvas for video call frame capture */}
      <canvas ref={vcCanvasRef} style={{ display: "none" }} />

      {/* ── Video Call Fullscreen ── */}
      <AnimatePresence>
        {videoCallOn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000", display: "flex", flexDirection: "column" }}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: vcFacing === "user" ? "scaleX(-1)" : "none" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,.6) 0%,transparent 30%,transparent 50%,rgba(0,0,0,.7) 100%)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "40px 16px 0" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", animation: "pulse 2s infinite" }} />
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Hind Siliguri',sans-serif" }}>ভিডিও কল • পারিসা AI</p>
                <p style={{ color: "rgba(255,255,255,.6)", fontSize: 12, marginLeft: 8, fontFamily: "'Hind Siliguri',sans-serif" }}>{callStatus}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingBottom: 16, padding: "0 24px 16px" }}>
                {callCaption && (
                  <div style={{ width: "100%", background: "rgba(0,0,0,.65)", border: "1px solid rgba(255,255,255,.15)", backdropFilter: "blur(8px)", borderRadius: 14, padding: "10px 14px", textAlign: "center" }}>
                    <p style={{ color: "#fff", fontSize: 14, lineHeight: 1.6, fontFamily: "'Hind Siliguri',sans-serif" }}>{callCaption}</p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button onClick={endVideoCall}
                    style={{ padding: "10px 32px", borderRadius: 999, background: "#d23b3b", border: "1px solid #ff6b6b", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'Hind Siliguri',sans-serif", cursor: "pointer" }}>
                    কল শেষ
                  </button>
                  <IcBtn onClick={flipVcCamera} title="ক্যামেরা পাল্টান" style={{ width: 48, height: 48, borderRadius: 999, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)" }}>
                    <SvgIcon d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" size={20} stroke="#fff" />
                  </IcBtn>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Camera Mode Fullscreen ── */}
      <AnimatePresence>
        {cameraOn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 90, background: "#02141a", display: "flex", flexDirection: "column" }}>
            <video ref={camVideoRef} autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={camCanvasRef} style={{ display: "none" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,12,16,.45),transparent 25%,transparent 60%,rgba(0,12,16,.7))", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 16, paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <IcBtn onClick={closeCam} title="বন্ধ">
                  <SvgIcon d="M18 6L6 18M6 6l12 12" size={18} stroke="currentColor" />
                </IcBtn>
                <p style={{ fontWeight: 600, color: "#d8f3fb", fontFamily: "'Hind Siliguri',sans-serif" }}>ক্যামেরা মোড</p>
                <IcBtn onClick={flipCam} title="ক্যামেরা পাল্টান">
                  <SvgIcon d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" size={18} stroke="currentColor" />
                </IcBtn>
              </div>
              {camCaption && (
                <div style={{ alignSelf: "center", maxWidth: "90%", padding: "10px 14px", borderRadius: 14, background: "rgba(0,30,40,.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(180,240,250,.15)", color: "#d8f3fb", fontSize: 14, textAlign: "center", fontFamily: "'Hind Siliguri',sans-serif" }}>
                  {camCaption}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <button onClick={() => askAboutCamera()}
                  style={{ padding: "12px 20px", borderRadius: 999, background: "linear-gradient(135deg,#5fe8ff,#00d4d4)", color: "#04222a", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 20px rgba(0,220,230,.35)", fontFamily: "'Hind Siliguri',sans-serif" }}>
                  কী দেখছো?
                </button>
                <IcBtn onClick={camMic} title="ভয়েস">
                  <SvgIcon d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" size={18} stroke="currentColor" />
                </IcBtn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sidebar (RIGHT side) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,12,16,.35)", backdropFilter: "blur(2px)" }}
              onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="parisa-glass"
              style={{ position: "fixed", right: 0, top: 0, height: "100dvh", width: "88vw", maxWidth: 320, zIndex: 50, display: "flex", flexDirection: "column", gap: 8, padding: 14, paddingTop: "max(14px, env(safe-area-inset-top))", paddingBottom: "max(14px, env(safe-area-inset-bottom))", borderLeft: "1px solid rgba(180,240,250,.10)", borderRight: "none", borderRadius: "18px 0 0 18px" }}>
              <div style={{ textAlign: "center", paddingBottom: 12, borderBottom: "1px solid rgba(180,240,250,.08)" }}>
                <span className="parisa-brand-title" style={{ fontSize: 20, letterSpacing: 6 }}>PARISA</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10 }}>
                <button onClick={() => setSidebarOpen(false)} className="parisa-ic-btn">
                  <SvgIcon d="M18 6L6 18M6 6l12 12" size={18} stroke="currentColor" />
                </button>
                <button onClick={() => { newChat(); }}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "linear-gradient(90deg,rgba(95,232,255,.14),rgba(0,212,212,.14))", color: "#eafaff", border: "1px solid rgba(95,232,255,.25)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "'Hind Siliguri',sans-serif", fontSize: 14 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> নতুন চ্যাট
                </button>
              </div>
              <p style={{ fontSize: 11, opacity: .6, margin: "14px 4px 6px", letterSpacing: 1, textTransform: "uppercase", color: "#8fd9e6" }}>পিন করা</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: "26vh" }}>
                {pinnedSessions.length === 0 && <p style={{ opacity: .45, fontSize: 12, padding: "6px 4px", fontFamily: "'Hind Siliguri',sans-serif" }}>কিছুই পিন করা নেই</p>}
                {pinnedSessions.map(s => (
                  <SidebarItem key={s.id} session={s} active={s.id === currentId}
                    onSelect={() => switchSession(s.id)} onPin={() => pinSession(s.id)} onDelete={() => deleteSession(s.id)} />
                ))}
              </div>
              <p style={{ fontSize: 11, opacity: .6, margin: "14px 4px 6px", letterSpacing: 1, textTransform: "uppercase", color: "#8fd9e6" }}>সাম্প্রতিক</p>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
                {recentSessions.length === 0 && <p style={{ opacity: .45, fontSize: 12, padding: "6px 4px", fontFamily: "'Hind Siliguri',sans-serif" }}>সাম্প্রতিক কোনো চ্যাট নেই</p>}
                {recentSessions.map(s => (
                  <SidebarItem key={s.id} session={s} active={s.id === currentId}
                    onSelect={() => switchSession(s.id)} onPin={() => pinSession(s.id)} onDelete={() => deleteSession(s.id)} />
                ))}
              </div>
              <div style={{ marginTop: "auto", paddingTop: 10 }}>
                <button onClick={() => { setSidebarOpen(false); setSettingsOpen(true); }}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: "rgba(180,240,250,.04)", border: "1px solid rgba(180,240,250,.12)", color: "#d8f3fb", textAlign: "left", fontWeight: 500, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "'Hind Siliguri',sans-serif" }}>
                  <SvgIcon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" size={18} stroke="currentColor" />
                  সেটিংস
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Settings Modal ── */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,12,16,.55)", backdropFilter: "blur(6px)" }}
              onClick={() => setSettingsOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              className="parisa-glass"
              style={{ position: "fixed", inset: "auto 16px 16px", zIndex: 70, borderRadius: 18, padding: 20, maxWidth: 440, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "1px solid rgba(180,240,250,.10)", paddingBottom: 12 }}>
                <span style={{ fontWeight: 700, color: "#d8f3fb", fontFamily: "'Hind Siliguri',sans-serif" }}>সেটিংস</span>
                <button onClick={() => setSettingsOpen(false)} className="parisa-ic-btn">
                  <SvgIcon d="M18 6L6 18M6 6l12 12" size={16} stroke="currentColor" />
                </button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <p style={{ color: "rgba(216,243,251,.6)", fontSize: 13, marginBottom: 8, fontFamily: "'Hind Siliguri',sans-serif" }}>ভয়েস নির্বাচন করুন</p>
                {[{ val: "female", label: "🎙️ PARISA (Female)" }, { val: "male", label: "🎙️ RUBEL (Male)" }].map(v => (
                  <button key={v.val} onClick={() => setVoiceGender(v.val as "female" | "male")}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: "rgba(180,240,250,.04)", border: `1px solid ${voiceGender === v.val ? "rgba(95,232,255,.45)" : "rgba(180,240,250,.10)"}`, marginBottom: 8, color: "#d8f3fb", fontFamily: "'Hind Siliguri',sans-serif" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${voiceGender === v.val ? "#5fe8ff" : "rgba(255,255,255,.4)"}`, background: voiceGender === v.val ? "#5fe8ff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {voiceGender === v.val && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#04222a" }} />}
                    </div>
                    {v.label}
                  </button>
                ))}
                <button onClick={() => speakText("আসসালামু আলাইকুম আমি পারিসা মেমোরি পোর্টালের ড্যাশবোর্ডের সহকারী আপনার ভয়েস চেক করা হচ্ছে", voiceGender)}
                  style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(180,240,250,.05)", border: "1px solid rgba(180,240,250,.14)", color: "#d8f3fb", cursor: "pointer", fontFamily: "'Hind Siliguri',sans-serif" }}>
                  ভয়েস টেস্ট করুন
                </button>
              </div>
              <div style={{ borderTop: "1px solid rgba(180,240,250,.10)", paddingTop: 14, marginBottom: 14 }}>
                <p style={{ color: "rgba(216,243,251,.6)", fontSize: 13, marginBottom: 8, fontFamily: "'Hind Siliguri',sans-serif" }}>আপনার নাম (AI আপনাকে এই নামে ডাকবে)</p>
                <input type="text" value={userNameInput} onChange={e => setUserNameInput(e.target.value)}
                  placeholder="আপনার নাম লিখুন"
                  style={{ width: "100%", background: "rgba(180,240,250,.04)", border: "1px solid rgba(180,240,250,.14)", padding: "10px 12px", borderRadius: 10, outline: "none", color: "#eafaff", fontSize: 14, fontFamily: "'Hind Siliguri',sans-serif", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setUserNameInput(""); setUserName(""); localStorage.removeItem("parisa_username"); }}
                  style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(180,240,250,.05)", border: "1px solid rgba(180,240,250,.14)", color: "#d8f3fb", cursor: "pointer", fontFamily: "'Hind Siliguri',sans-serif" }}>
                  রিসেট
                </button>
                <button onClick={saveUserName}
                  style={{ flex: 1, padding: "9px 18px", borderRadius: 10, background: "linear-gradient(135deg,#5fe8ff,#00d4d4)", color: "#04222a", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "'Hind Siliguri',sans-serif" }}>
                  সেভ
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Topbar ── */}
      <header className="parisa-glass" style={{ flexShrink: 0, display: "grid", gridTemplateColumns: "40px 1fr 40px", alignItems: "center", gap: 8, padding: "12px 14px 6px", paddingTop: "max(12px, env(safe-area-inset-top))", borderRadius: 0, borderTop: "none", borderLeft: "none", borderRight: "none" }}>
        <IcBtn onClick={() => setLocation("/dashboard")} title="ড্যাশবোর্ড">
          <SvgIcon d="M19 12H5M12 5l-7 7 7 7" size={18} stroke="currentColor" />
        </IcBtn>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span className="parisa-brand-title" style={{ fontSize: 20, letterSpacing: 8 }}>PARISA</span>
        </div>
        <IcBtn onClick={() => setSidebarOpen(true)} title="চ্যাট হিস্টরি">
          <SvgIcon d="M3 6h18M3 12h18M3 18h18" size={18} stroke="currentColor" />
        </IcBtn>
      </header>

      {/* ── Messages ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 0 4px" }}>
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100%", padding: 20, textAlign: "center", gap: 16 }}>
            <div style={{ position: "relative", width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%,rgba(180,240,250,.16),rgba(0,220,230,.02) 65%)", border: "1px solid rgba(180,240,250,.18)", display: "grid", placeItems: "center", marginBottom: 6, backdropFilter: "blur(16px)", boxShadow: "inset 0 0 36px rgba(180,240,250,.10),0 8px 38px rgba(0,220,230,.20)", overflow: "hidden" }}>
              <div className="parisa-smoke s1" />
              <div className="parisa-smoke s2" />
              <div className="parisa-smoke s3" />
              <div className="parisa-smoke s4" />
              <img src={PROFILE_LOGO} alt="পারিসা" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .22, mixBlendMode: "screen", filter: "brightness(1.3) saturate(108%) contrast(.92)" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p className="parisa-tagline" style={{ color: "rgba(216,243,251,.75)", fontSize: 14, fontFamily: "'Hind Siliguri',sans-serif", margin: 0 }}>মায়া কখনোই কাটানো যায় না..</p>
              <p className="parisa-tagline t2" style={{ color: "rgba(216,243,251,.75)", fontSize: 14, fontFamily: "'Hind Siliguri',sans-serif", margin: 0 }}>এটা মৃত্যুর আগ পর্যন্ত থেকে যায়...😘😘</p>
            </div>
            <h1 className="parisa-brand-title" style={{ fontSize: 26, letterSpacing: 8, margin: 0 }}>WELCOME</h1>
            <p style={{ color: "rgba(174,226,236,.75)", fontSize: 14, margin: 0, fontFamily: "'Hind Siliguri',sans-serif" }}>
              {userName ? `${userName}, কী জানতে চান?` : "আমি পারিসা — কী জানতে চান, লিখুন বা বলুন।"}
            </p>
            <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="parisa-sugg" onClick={() => { setInput(s); setTimeout(() => { sendMessage(s); setInput(""); }, 50); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingBottom: 8 }}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onSpeak={() => speakText(msg.content, voiceGender)} onRetry={msg.failed && msg.retryText ? () => sendMessage(msg.retryText!) : undefined} />
            ))}
            {aiTyping && (
              <div style={{ padding: "8px 14px", display: "flex" }}>
                <div className="parisa-msg-ai" style={{ maxWidth: "88%", padding: "12px 14px", borderRadius: 16 }}>
                  <div className="parisa-typing" style={{ display: "inline-flex", gap: 4 }}>
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Composer ── */}
      <div style={{ padding: "8px 10px 12px", paddingBottom: "max(12px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
        {pendingImage && (
          <div style={{ display: "flex", gap: 8, padding: "0 6px 8px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(180,240,250,.06)", border: "1px solid rgba(180,240,250,.14)", padding: "4px 8px", borderRadius: 10, fontSize: 12, color: "#d8f3fb", fontFamily: "'Hind Siliguri',sans-serif" }}>
              📎 {pendingFileName}
              <button onClick={() => { setPendingImage(null); setPendingFileName(""); }} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        )}
        <div className="parisa-composer">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
            <IcBtn onClick={() => fileInputRef.current?.click()} title="ফাইল সংযুক্ত করুন" style={{ borderColor: "rgba(0,229,180,.35)", background: "linear-gradient(180deg,rgba(0,229,180,.10),rgba(0,200,160,.04))" }}>
              <SvgIcon d="M21.44 11.05L12.25 20.24a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" size={18} stroke="rgba(0,229,180,.90)" />
            </IcBtn>
            <IcBtn onClick={() => openCam(camFacing)} title="ক্যামেরা" style={{ borderColor: "rgba(0,229,180,.35)", background: "linear-gradient(180deg,rgba(0,229,180,.10),rgba(0,200,160,.04))" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(0,229,180,.90)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </IcBtn>
            <IcBtn onClick={startAudioCall} title="অডিও কল" style={{ borderColor: "rgba(0,229,180,.35)", background: "linear-gradient(180deg,rgba(0,229,180,.10),rgba(0,200,160,.04))" }}>
              <SvgIcon d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0122 16.92z" size={18} stroke="rgba(0,229,180,.90)" />
            </IcBtn>
            <IcBtn onClick={startVideoCall} title="ভিডিও কল" style={{ borderColor: "rgba(0,229,180,.35)", background: "linear-gradient(180deg,rgba(0,229,180,.10),rgba(0,200,160,.04))" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" fill="rgba(0,229,180,.90)" stroke="none"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" stroke="rgba(0,229,180,.90)" fill="none"/>
              </svg>
            </IcBtn>
          </div>
          <div className="parisa-composer-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="কিছু লিখুন বা জিজ্ঞাসা করুন…"
              disabled={busy}
              lang="bn"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-gramm="false"
            />
            <IcBtn onClick={startMic} title="ভয়েস ইনপুট" className={micActive ? "mic-active" : ""}>
              <SvgIcon d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" size={18} stroke="currentColor" />
            </IcBtn>
            <IcBtn onClick={handleSend} title="পাঠান" className="send-btn">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="#6ff0ff" stroke="none">
                <path d="M5 12l14-7-7 14-2-5-5-2z" />
              </svg>
            </IcBtn>
          </div>
        </div>
      </div>
      <input ref={fileInputRef} type="file" hidden accept="image/*,application/pdf,audio/*,video/*,text/*,.html,.htm,.txt,.doc,.docx" onChange={handleFileChange} />
    </div>
  );
}

function SidebarItem({ session, active, onSelect, onPin, onDelete }: {
  session: ChatSession; active: boolean; onSelect: () => void; onPin: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 10px", borderRadius: 10, background: active ? "rgba(95,232,255,.14)" : "rgba(180,240,250,.03)", border: `1px solid ${active ? "rgba(95,232,255,.35)" : "rgba(180,240,250,.07)"}`, cursor: "pointer" }}>
      <div style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13, color: "#d8f3fb", fontFamily: "'Hind Siliguri',sans-serif" }} onClick={onSelect}>
        {session.title || "নতুন চ্যাট"}
      </div>
      <div style={{ display: "flex", gap: 2, opacity: .6 }}>
        <button onClick={onPin} title="পিন" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 4 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 6 6 1-4.5 4.5 1 6L12 17l-5.5 2.5 1-6L3 9l6-1z"/></svg>
        </button>
        <button onClick={onDelete} title="ডিলিট" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 4 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    </div>
  );
}

function applyInlineBold(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return s;
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\*\*([^*]+)\*\*$/);
        if (m) return <strong key={i} style={{ fontWeight: 700, color: "#e0f8ff" }}>{m[1]}</strong>;
        return p || null;
      })}
    </>
  );
}

function renderMarkdownLines(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Numbered list: 1. or ১. or 1) or ১। etc.
    const numMatch = line.match(/^([০-৯0-9]+)[.)।]\s*(.+)/);
    if (numMatch) {
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 2 }}>
          <span style={{ color: '#5fe8ff', fontWeight: 700, minWidth: 22, flexShrink: 0, fontFamily: "'Hind Siliguri',sans-serif" }}>{numMatch[1]}.</span>
          <span>{applyInlineBold(numMatch[2])}</span>
        </div>
      );
      continue;
    }
    // Bullet list: - or • or *
    const bulletMatch = line.match(/^[-•]\s+(.+)/);
    if (bulletMatch) {
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 2 }}>
          <span style={{ color: '#5fe8ff', fontWeight: 700, flexShrink: 0 }}>•</span>
          <span>{applyInlineBold(bulletMatch[1])}</span>
        </div>
      );
      continue;
    }
    // Bold heading: ### ## #
    const headMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headMatch) {
      nodes.push(
        <div key={i} style={{ fontWeight: 700, fontSize: 15, margin: '6px 0 2px', color: '#5fe8ff', fontFamily: "'Hind Siliguri',sans-serif" }}>
          {applyInlineBold(headMatch[1])}
        </div>
      );
      continue;
    }
    // Empty line → spacing
    if (!line.trim()) {
      nodes.push(<div key={i} style={{ height: 6 }} />);
      continue;
    }
    // Regular line
    nodes.push(<div key={i}>{applyInlineBold(line)}</div>);
  }
  return <>{nodes}</>;
}

function renderMsgContent(content: string): React.ReactNode {
  const parts = content.split(/(<<IMG:[^>]+>>)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^<<IMG:([^>]+)>>$/);
        if (m) {
          const fileId = m[1];
          return (
            <div key={i} style={{ margin: "8px 0" }}>
              <img
                src={`/api/drive/proxy/${fileId}`}
                alt="স্ক্রিনশট"
                style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 10, display: "block", border: "1px solid rgba(180,240,250,.15)" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          );
        }
        return part ? <span key={i}>{renderMarkdownLines(part)}</span> : null;
      })}
    </>
  );
}

function MessageBubble({ msg, onSpeak, onRetry }: {
  msg: Msg; onSpeak: () => void; onRetry?: () => void;
}) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(msg.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  }
  return (
    <div style={{ padding: "8px 14px", display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div className={isUser ? "parisa-msg-user" : "parisa-msg-ai"} style={{ maxWidth: "88%", padding: "12px 14px", borderRadius: 16, lineHeight: 1.6, wordBreak: "break-word", fontSize: 15 }}>
        {msg.imageUrl && (
          <img src={msg.imageUrl} alt="" style={{ maxWidth: 240, borderRadius: 10, marginBottom: 8, display: "block" }} />
        )}
        <div lang="bn" style={{ color: "#d8f3fb", fontFamily: "'Noto Sans Bengali','Hind Siliguri',sans-serif", unicodeBidi: "plaintext" }}>
          {isUser ? msg.content : renderMsgContent(msg.content)}
        </div>
        {!isUser && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, opacity: .85 }}>
            <button onClick={copy} style={{ background: "rgba(180,240,250,.04)", border: "1px solid rgba(180,240,250,.12)", color: "#d8f3fb", padding: "6px 9px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "'Hind Siliguri',sans-serif" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              {copied ? "হয়েছে" : "কপি"}
            </button>
            <button onClick={onSpeak} style={{ background: "rgba(180,240,250,.04)", border: "1px solid rgba(180,240,250,.12)", color: "#d8f3fb", padding: "6px 9px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "'Hind Siliguri',sans-serif" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
              ভয়েস
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
