def test_decimal_billing_math():
    from decimal import Decimal, ROUND_HALF_UP
    subtotal = (Decimal("19.99") * Decimal("3")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    assert subtotal == Decimal("59.97")
    assert subtotal - Decimal("5.00") == Decimal("54.97")
