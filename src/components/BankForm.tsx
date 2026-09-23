import { useState } from "react";
import { formatToman } from "../lib/format";
import { parse } from "../lib/parser";
import { useStore } from "../store/useStore";
import type { Bank } from "../types";

const splitList = (s: string) =>
  s
    .split(/[\n,،]/)
    .map((x) => x.trim())
    .filter(Boolean);

interface Props {
  initial?: Bank;
  onDone: () => void;
}

export default function BankForm({ initial, onDone }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [packages, setPackages] = useState(initial?.matchPackages.join("\n") ?? "");
  const [senders, setSenders] = useState(initial?.matchSenderIds.join("\n") ?? "");
  const [regex, setRegex] = useState(initial?.regexAmount ?? "([\\d,]+)\\s*ريال");
  const [income, setIncome] = useState(initial?.incomeKeywords.join("، ") ?? "واریز");
  const [expense, setExpense] = useState(initial?.expenseKeywords.join("، ") ?? "خرید، برداشت");
  const [sample, setSample] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addBank = useStore((s) => s.addBank);
  const updateBank = useStore((s) => s.updateBank);

  const draft = { regexAmount: regex, incomeKeywords: splitList(income), expenseKeywords: splitList(expense) };
  const test = sample.trim() ? parse(draft, sample) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("نام بانک الزامی است");
    try {
      new RegExp(regex);
    } catch {
      return setError("regex مبلغ نامعتبر است");
    }
    const data = {
      name: name.trim(),
      matchPackages: splitList(packages),
      matchSenderIds: splitList(senders),
      ...draft,
    };
    if (data.matchPackages.length === 0 && data.matchSenderIds.length === 0) {
      return setError("حداقل یک نام پکیج یا شناسه فرستنده پیامک لازم است");
    }
    if (initial) updateBank(initial.id, data);
    else addBank({ ...data, enabled: true, isDefault: false });
    onDone();
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h3>{initial ? `ویرایش ${initial.name}` : "افزودن بانک"}</h3>
      <label>
        نام بانک
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        نام پکیج اپ بانک (هر خط یکی)
        <textarea dir="ltr" rows={2} value={packages} onChange={(e) => setPackages(e.target.value)} placeholder="com.example.bank" />
      </label>
      <details className="help">
        <summary>نام پکیج را از کجا پیدا کنم؟</summary>
        <ul>
          <li>
            در همین برنامه (نسخه اندروید) در بخش «دریافت خودکار» گزینه «ثبت همه اعلان‌ها و پیامک‌ها» را روشن کنید، یک
            اعلان از اپ بانک دریافت کنید و نام پکیج را در «لاگ خام» ببینید.
          </li>
          <li>یا: تنظیمات اندروید ← اعلان‌ها ← تاریخچه اعلان‌ها (در برخی گوشی‌ها نام پکیج نمایش داده می‌شود).</li>
          <li>یا: آدرس صفحه اپ در Google Play/مایکت/بازار — بخش بعد از <code dir="ltr">id=</code> نام پکیج است.</li>
        </ul>
      </details>
      <label>
        شناسه فرستنده پیامک (هر خط یکی)
        <textarea dir="ltr" rows={2} value={senders} onChange={(e) => setSenders(e.target.value)} placeholder="+98999... یا BankName" />
      </label>
      <details className="help">
        <summary>شناسه فرستنده پیامک چیست؟</summary>
        <p>
          شماره یا نامی که پیامک بانک از آن می‌آید (مثلاً <code dir="ltr">+9890000...</code> یا <code dir="ltr">9820000...</code>).
          آن را در اپ پیامک گوشی روی یک پیامک واقعی بانک ببینید. مقایسه بدون توجه به <code dir="ltr">+</code>، فاصله و
          پیشوند ۰۰۹۸/۹۸/۰ انجام می‌شود.
        </p>
      </details>
      <label>
        regex مبلغ (دقیقاً یک گروه capture برای عدد)
        <input dir="ltr" value={regex} onChange={(e) => setRegex(e.target.value)} />
      </label>
      <label>
        کلمات کلیدی درآمد (با ویرگول جدا کنید)
        <input value={income} onChange={(e) => setIncome(e.target.value)} />
      </label>
      <label>
        کلمات کلیدی هزینه (با ویرگول جدا کنید)
        <input value={expense} onChange={(e) => setExpense(e.target.value)} />
      </label>
      <label>
        تست با یک پیامک/اعلان نمونه
        <textarea rows={3} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="متن یک پیامک واقعی بانک را اینجا بچسبانید" />
      </label>
      {test && (
        <p className={test.ok ? (test.result.typeUncertain ? "warn" : "ok") : "error"}>
          {test.ok
            ? `✓ ${formatToman(test.result.amount)} — ${test.result.type === "income" ? "درآمد" : "هزینه"}${
                test.result.typeUncertain ? " (نامطمئن: هیچ کلمه کلیدی پیدا نشد)" : ""
              }`
            : `✗ ${test.error}`}
        </p>
      )}
      <p className="muted small">مبالغ همیشه به ریال ذخیره و به تومان نمایش داده می‌شوند. regex باید عدد ریالی را بگیرد.</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="primary">
          ذخیره
        </button>
        <button type="button" onClick={onDone}>
          انصراف
        </button>
      </div>
    </form>
  );
}
