package com.personalcost.app.parsing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ParserEngineTest {
    private val rule = BankRule(
        id = "blu",
        name = "بلوبانک",
        matchPackages = listOf("com.example.blu"),
        matchSenderIds = listOf("+989991234567", "BluBank"),
        regexAmount = "([\\d,]+)\\s*ريال",
        incomeKeywords = listOf("واریز", "افزایش موجودی"),
        expenseKeywords = listOf("خرید", "برداشت", "کسر"),
        enabled = true,
        isDefault = true,
    )

    private fun parse(text: String) = ParserEngine.parse(rule, text, ParserEngine.Source.SMS, 0L)

    @Test fun parsesExpense() {
        val tx = parse("خرید از فروشگاه مبلغ 1,250,000 ريال")!!
        assertEquals(1_250_000L, tx.amount)
        assertEquals("expense", tx.type)
        assertFalse(tx.typeUncertain)
    }

    @Test fun normalizesPersianDigitsSeparatorsAndYeh() {
        val tx = parse("واریز ۲٬۵۰۰٬۰۰۰ ریال به حساب شما")!!
        assertEquals(2_500_000L, tx.amount)
        assertEquals("income", tx.type)
    }

    @Test fun flagsUnclearType() {
        val tx = parse("تراکنش 10,000 ريال")!!
        assertEquals("expense", tx.type)
        assertTrue(tx.typeUncertain)
    }

    @Test fun returnsNullWhenRegexDoesNotMatch() {
        assertNull(parse("سلام"))
    }

    @Test fun matchesKeywordsAcrossZwnj() {
        assertEquals("income", parse("افزایش‌موجودی 5,000 ريال")!!.type)
    }

    @Test fun invalidRegexFailsGracefully() {
        val out = ParserEngine.parseDetailed(rule.copy(regexAmount = "(["), "1 ريال", ParserEngine.Source.SMS)
        assertTrue(out is ParserEngine.Outcome.Failed)
    }

    @Test fun senderNormalization() {
        assertTrue(rule.matchesSender("00989991234567"))
        assertTrue(rule.matchesSender("09991234567"))
        assertTrue(rule.matchesSender("+98 999 123 4567"))
        assertTrue(rule.matchesSender("blubank"))
        assertFalse(rule.matchesSender("+989990000000"))
        assertFalse(rule.matchesSender(null))
    }
}
