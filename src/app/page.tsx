import Image from "next/image";
import Link from "next/link";
import { hanasaki } from "@/characters/hanasaki";

const characters = [hanasaki];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-5 py-10">
      <header className="text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-rose-400">
          TAKANE NO HANAKO-SAN
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-800">
          高嶺の花子さん
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          高嶺の花とチャット。
          <br />
          表面の言葉だけじゃなく、<span className="text-rose-500">内心</span>
          まで覗ける、ちょっとドキドキする会話練習。
        </p>
      </header>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-3xl bg-gradient-to-br from-rose-100 via-white to-pink-100 shadow-md ring-1 ring-rose-100">
        <Image
          src={hanasaki.images.smile}
          alt={hanasaki.name}
          fill
          sizes="(max-width: 768px) 80vw, 280px"
          className="object-cover object-top"
          priority
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent px-4 py-3 text-white">
          <p className="text-[10px] font-semibold tracking-widest opacity-90">
            CHARACTER 01
          </p>
          <p className="text-base font-bold">{hanasaki.name}</p>
          <p className="text-[11px] opacity-90">
            {hanasaki.age}歳 ・ {hanasaki.occupation}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          話せる相手
        </h2>
        {characters.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="group flex items-center gap-4 rounded-2xl border border-rose-100 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-rose-100 to-pink-200 ring-1 ring-rose-100">
              <Image
                src={c.images.smile}
                alt={c.name}
                fill
                sizes="64px"
                className="object-cover object-top"
                priority
              />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-slate-800">
                  {c.name}
                </span>
                <span className="text-xs text-slate-500">{c.age}歳</span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                {c.occupation}
              </p>
              <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                「{c.greeting}」
              </p>
            </div>
            <span
              aria-hidden
              className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-rose-400"
            >
              ›
            </span>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs leading-relaxed text-slate-500">
        <p className="font-semibold text-slate-600">遊び方</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>キャラを選んでチャット開始</li>
          <li>各メッセージの「💭内心を見る」で本音をチェック</li>
          <li>会話を重ねて好感度を育てよう</li>
          <li>「分析する」で自分の会話を5軸スコアで振り返り</li>
        </ol>
      </section>

      <footer className="mt-auto pt-8 text-center text-[11px] text-slate-400">
        Powered by Gemini ・ for fun & practice
      </footer>
    </main>
  );
}
