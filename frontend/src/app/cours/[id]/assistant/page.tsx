"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { ChevronLeftIcon, FlagIcon, MessageIcon, SendIcon } from "@/components/Icons";
import { Notice, SourceChip, BackHeader } from "@/components/Revision";
import { Screen } from "@/components/Screen";
import { askAssistant } from "@/lib/api";
import { saveMessage, saveReport, useMessages, useNotions } from "@/lib/data";
import { answerFromCourse, answerToAction, type AssistantAction } from "@/lib/revision";
import { useCourseScreen } from "@/lib/use-courses";
import { useFeatureGate } from "@/lib/use-feature-gate";
import type { Message } from "@/lib/types";
import Link from "next/link";

const ACTIONS: { id: AssistantAction; label: string }[] = [
  { id: "autrement", label: "Explique-moi autrement" },
  { id: "exemple", label: "Donne-moi un exemple" },
  { id: "quiz", label: "Fais-moi un quiz sur ça" },
];

const hour = (at: number) => new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function Assistant() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const notionParam = params.get("notion");
  const questionParam = params.get("q");
  const enabled = useFeatureGate("assistant", `/cours/${id}`);
  const state = useCourseScreen(id);
  const uid = state.phase === "ready" ? state.user.uid : undefined;
  const { items: notions, loaded: notionsLoaded } = useNotions(uid, id);
  const { messages } = useMessages(uid, id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [prefilled, setPrefilled] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  // « Poser une question » depuis la séance : on propose une question sur la notion en cours.
  useEffect(() => {
    if (prefilled || !notionParam) return;
    const notion = notions.find((item) => item.id === notionParam);
    if (!notion) return;
    setPrefilled(true);
    setText(`Peux-tu m’expliquer « ${notion.title} » ?`);
  }, [prefilled, notionParam, notions]);

  // Une question venue du détail du cours (suggestion ou champ de saisie) est envoyée une seule fois.
  useEffect(() => {
    if (autoSent.current || !questionParam || state.phase !== "ready" || !notionsLoaded) return;
    autoSent.current = true;
    const { user, course } = state;
    void (async () => {
      await saveMessage(user, id, { role: "user", text: questionParam, at: Date.now() });
      const answer = (await askAssistant(id, questionParam)) ?? answerFromCourse(questionParam, notions, course.name);
      const reply: Omit<Message, "id"> = { role: "assistant", text: answer.text, at: Date.now() };
      if (answer.source) reply.source = answer.source;
      await saveMessage(user, id, reply);
    })();
  }, [questionParam, state, notionsLoaded, notions, id]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  if (!enabled || state.phase === "waiting") return <Screen app />;
  if (state.phase === "missing") {
    return (
      <Screen>
        <BackHeader href="/cours" title="Cours introuvable" />
        <Notice>Ce cours n’existe pas ou a été supprimé.</Notice>
      </Screen>
    );
  }

  const { user, course } = state;

  // La dernière notion dont on a parlé : celle que cite la dernière réponse.
  const lastSource = [...messages].reverse().find((message) => message.role === "assistant" && message.source)?.source;
  const lastNotion = notions.find((notion) => notion.source === lastSource);

  async function send(
    question: string,
    reply: (notionHint: typeof lastNotion) => { text: string; source?: string } | Promise<{ text: string; source?: string }>,
    then?: () => void
  ) {
    setBusy(true);
    const now = Date.now();
    try {
      await saveMessage(user, id, { role: "user", text: question, at: now });
      const answer = await reply(lastNotion);
      const message: Omit<Message, "id"> = { role: "assistant", text: answer.text, at: Date.now() };
      if (answer.source) message.source = answer.source;
      await saveMessage(user, id, message);
      then?.();
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = text.trim();
    if (!question || busy) return;
    setText("");
    await send(question, async () => (await askAssistant(id, question)) ?? answerFromCourse(question, notions, course.name));
  }

  async function onAction(action: AssistantAction, label: string) {
    if (busy) return;
    await send(label, (notion) => answerToAction(action, notion, course.name), action === "quiz" && lastNotion ? () => router.push(`/cours/${id}/quiz`) : undefined);
  }

  return (
    <Screen app>
      <DemoBanner />
      <header className="flex items-center gap-2 border-b border-line bg-card px-2 pb-2.5 pt-3">
        <Link href={`/cours/${id}`} aria-label="Retour" className="flex h-11 w-11 shrink-0 items-center justify-center">
          <ChevronLeftIcon />
        </Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <MessageIcon size={22} />
        </span>
        <div className="flex flex-col">
          <h1 className="font-display text-[17px] font-bold">Assistant PlugStudy</h1>
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            Disponible 24h/24
          </p>
        </div>
      </header>

      <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-3">
        <p className="self-center text-center text-[13px] text-muted">
          Les réponses viennent uniquement de ton cours {course.name}.
        </p>

        {messages.length === 0 ? (
          <p className="self-center rounded-2xl border border-line bg-card px-4 py-3 text-center text-[15px] leading-relaxed text-muted">
            Pose ta première question sur ton cours, ou choisis une suggestion ci-dessous.
          </p>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <div
              key={message.id}
              className="flex max-w-[82%] flex-col gap-0.5 self-end rounded-[18px_18px_4px_18px] bg-accent px-3.5 py-2.5 text-on-accent"
            >
              <p className="text-base font-medium leading-snug">{message.text}</p>
              <span className="self-end text-xs">{hour(message.at)}</span>
            </div>
          ) : (
            <div
              key={message.id}
              className="flex max-w-[92%] flex-col gap-2.5 self-start rounded-[18px_18px_18px_4px] border border-line bg-card px-3.5 py-3"
            >
              <p className="text-[15px] leading-relaxed">{message.text}</p>
              {message.source ? (
                <div className="flex flex-wrap items-center gap-2">
                  <SourceChip source={message.source} />
                  <button
                    type="button"
                    disabled={reported.has(message.id)}
                    onClick={async () => {
                      setReported((current) => new Set(current).add(message.id));
                      try {
                        await saveReport(user, { courseId: id, messageId: message.id });
                      } catch {
                        setReported((current) => {
                          const next = new Set(current);
                          next.delete(message.id);
                          return next;
                        });
                      }
                    }}
                    className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted disabled:opacity-70"
                  >
                    <FlagIcon size={18} />
                    {reported.has(message.id) ? "Signalé, merci" : "Signaler"}
                  </button>
                </div>
              ) : null}
              <span className="self-end text-xs text-muted">{hour(message.at)}</span>
            </div>
          )
        )}
        <div ref={end} />
      </div>

      <div className="flex gap-2 overflow-x-auto px-5 pb-2 pt-1.5">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={busy}
            onClick={() => void onAction(action.id, action.label)}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-full border-[1.5px] border-accent bg-card px-4 text-sm font-semibold text-pale2 disabled:opacity-60"
          >
            {action.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2.5 border-t border-line bg-card px-4 pb-4 pt-2.5">
        <input
          type="text"
          aria-label="Ta question"
          placeholder="Pose ta question sur ton cours"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-12 min-w-0 flex-1 rounded-3xl border border-field bg-page px-[18px] text-[15px] text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label="Envoyer"
          disabled={busy || !text.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:bg-pale disabled:text-muted"
        >
          <SendIcon />
        </button>
      </form>
    </Screen>
  );
}

/** Écran 21 · Assistant : une conversation par cours, réponses tirées uniquement de ce cours, avec la source. */
export default function AssistantPage() {
  return (
    <Suspense fallback={<Screen app />}>
      <Assistant />
    </Suspense>
  );
}
