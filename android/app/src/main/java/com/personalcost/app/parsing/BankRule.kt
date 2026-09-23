package com.personalcost.app.parsing

/** Mirrors a Firestore `banks/{id}` document. Pure Kotlin so it can be unit-tested on the JVM. */
data class BankRule(
    val id: String,
    val name: String,
    val matchPackages: List<String>,
    val matchSenderIds: List<String>,
    val regexAmount: String,
    val incomeKeywords: List<String>,
    val expenseKeywords: List<String>,
    val enabled: Boolean,
    val isDefault: Boolean,
) {
    fun matchesPackage(packageName: String): Boolean =
        matchPackages.any { it.trim().equals(packageName, ignoreCase = true) }

    fun matchesSender(address: String?): Boolean {
        if (address.isNullOrBlank()) return false
        val a = normalizeSender(address)
        return matchSenderIds.any { normalizeSender(it) == a }
    }

    companion object {
        /**
         * Normalizes SMS sender ids so "+98 999 1234", "00989991234", "09991234" and "989991234"
         * compare equal, and alphanumeric senders compare case-insensitively.
         */
        fun normalizeSender(raw: String): String {
            var s = ParserEngine.normalizeDigits(raw).lowercase().filter { it.isLetterOrDigit() }
            if (s.all { it.isDigit() }) {
                s = when {
                    s.startsWith("0098") -> s.removePrefix("0098")
                    s.startsWith("98") && s.length > 10 -> s.removePrefix("98")
                    s.startsWith("0") -> s.removePrefix("0")
                    else -> s
                }
            }
            return s
        }
    }
}
