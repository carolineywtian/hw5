// Turn the Boss's key_facts into at most 3 short, readable headline numbers.
// Facts come in two shapes: plain ("160.0") and packed ("unit_price 49.3; margin_pct 55.38").

export interface FactLike {
  label: string
  value: string
}

export interface Headline {
  value: string // big text, e.g. "$160" or "8 of 20"
  label: string // 1–3 words, e.g. "Cash left"
  hint?: string // tiny note, e.g. "low" or "15% off list"
  tone: 'ok' | 'warn' | 'plain'
}

const usd = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })

/** Flatten facts into (key, number) pairs; a packed value yields one pair per "name number" part. */
function metrics(facts: FactLike[]): { label: string; key: string; num: number }[] {
  const out: { label: string; key: string; num: number }[] = []
  for (const f of facts) {
    const label = f.label.toLowerCase()
    const plain = f.value.replace(/[$,%\s]/g, '').replace(/^qty/i, '')
    if (/^-?\d+(\.\d+)?$/.test(plain)) {
      out.push({ label, key: label, num: Number(plain) })
      continue
    }
    for (const part of f.value.split(';')) {
      const m = part.trim().match(/^([a-z_ ]+?)\s+\$?(-?\d+(?:\.\d+)?)%?$/i)
      if (m) out.push({ label, key: m[1].toLowerCase().trim(), num: Number(m[2]) })
    }
  }
  return out
}

export function headlineNumbers(facts: FactLike[]): Headline[] {
  const ms = metrics(facts)
  const find = (re: RegExp, where: 'key' | 'label' | 'either' = 'either') =>
    ms.find((m) => (where !== 'label' && re.test(m.key)) || (where !== 'key' && re.test(m.label)))
  const out: Headline[] = []

  const cash = find(/available[_ ]cash|after (all )?known bills|cash left/)
  if (cash) out.push({ value: usd(cash.num), label: 'Cash left', hint: cash.num < 500 ? 'low' : undefined, tone: cash.num < 500 ? 'warn' : 'ok' })

  const onHand = find(/on hand|in stock/, 'label')
  const wanted = find(/requested (quantity|qty)/, 'label')
  if (onHand) {
    const short = wanted && onHand.num < wanted.num
    out.push({
      value: wanted ? `${onHand.num} of ${wanted.num}` : String(onHand.num),
      label: 'In stock',
      hint: short ? `short ${wanted!.num - onHand.num}` : undefined,
      tone: short ? 'warn' : 'ok',
    })
  }

  const price = find(/^unit_price$/, 'key')
  if (price) {
    const off = find(/discount/, 'key')
    out.push({ value: `${usd(price.num)} each`, label: 'Offer price', hint: off ? `${Math.round(off.num)}% off list` : undefined, tone: 'plain' })
  }

  const invoice = ms.find((m) => /invoice/.test(m.label) && /amount|invoice/.test(m.key) && m.num > 100)
  if (invoice) {
    const late = ms.find((m) => /days_overdue/.test(m.key))
    out.push({ value: usd(invoice.num), label: 'Invoice', hint: late ? `${late.num} days late` : undefined, tone: late ? 'warn' : 'plain' })
  }

  const rent = ms.find((m) => /rent/.test(m.label) && m.num > 100)
  if (rent) out.push({ value: usd(rent.num), label: 'Rent due', tone: 'plain' })

  return out.slice(0, 3)
}
