package com.personalcost.app.parsing

/**
 * Turns a bank SMS/notification into a transaction using that bank's rule.
 * Keep in sync with web/src/lib/parser.ts (used by the web "test regex" box).
 *
 * Amounts are returned exactly as the bank quotes them, which for Iranian banks is Rial.
 * Everything is stored in Rial; the web UI divides by 10 to show Toman.
 */
object ParserEngine {

    const val UNCLEAR_TYPE_NOTE = "auto: type unclear, please verify"

    enum class Source(val firestoreValue: String) { SMS("sms"), NOTIFICATION("notification") }

    data class ParsedTransaction(
        val amount: Long,
        val type: String, // "expense" | "income"
        val typeUncertain: Boolean,
        val bankId: String,
        val rawText: String,
        val source: Source,
        val timestamp: Long,
    )

    sealed interface Outcome {
        data class Parsed(val tx: ParsedTransaction) : Outcome
        data class Failed(val reason: String) : Outcome
    }

    fun parse(rule: BankRule, text: String, source: Source, timestamp: Long = System.currentTimeMillis()): ParsedTransaction? =
        (parseDetailed(rule, text, source, timestamp) as? Outcome.Parsed)?.tx

    fun parseDetailed(rule: BankRule, text: String, source: Source, timestamp: Long = System.currentTimeMillis()): Outcome {
        val regex = try {
            Regex(normalizeText(rule.regexAmount))
        } catch (e: Exception) {
            return Outcome.Failed("invalid regex: ${e.message}")
        }
        val norm = normalizeText(text)
        // Don't guess: no amount match means no transaction.
        val match = regex.find(norm) ?: return Outcome.Failed("amount regex did not match")
        val group = match.groups[1]?.value ?: return Outcome.Failed("regex has no capture group 1")
        val digits = group.filter { it.isDigit() }
        val amount = digits.toLongOrNull() ?: return Outcome.Failed("capture group had no digits: '$group'")
        if (amount <= 0) return Outcome.Failed("amount is zero")

        fun containsAny(keywords: List<String>) =
            keywords.any { k -> k.isNotBlank() && norm.contains(normalizeText(k.trim())) }

        val (type, uncertain) = when {
            containsAny(rule.expenseKeywords) -> "expense" to false
            containsAny(rule.incomeKeywords) -> "income" to false
            // Card transactions are usually expenses, but keep the ambiguity visible for review.
            else -> "expense" to true
        }
        return Outcome.Parsed(ParsedTransaction(amount, type, uncertain, rule.id, text, source, timestamp))
    }

    fun normalizeDigits(s: String): String = buildString(s.length) {
        for (c in s) {
            append(
                when (c) {
                    in '۰'..'۹' -> '0' + (c - '۰')
                    in '٠'..'٩' -> '0' + (c - '٠')
                    else -> c
                }
            )
        }
    }

    /** Persian/Arabic digits → ASCII, Persian/Arabic separators → ",", Arabic yeh/kaf → Persian, ZWNJ → space. */
    fun normalizeText(s: String): String = normalizeDigits(s)
        .replace('٬', ',')
        .replace('،', ',')
        .replace('ي', 'ی')
        .replace('ى', 'ی')
        .replace('ك', 'ک')
        .replace('‌', ' ')
}
