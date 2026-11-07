# Explain grounding

## Decision

An allow-list of rupiah figures does not make a financial sentence true.

On 6 Nov 2026 the live closing sentence for the demo day plus two added notes used only allowed numbers, including Rp0, and was still false. It said that if `es jeruk 15rb`, `jual nasi campur 3 x 15rb tunai`, and `es teh 2 10rb` were all tunai, the gap would be Rp0. Only the es jeruk note, taken alone as tunai, makes that gap Rp0. Counting the other two as tunai as well moves expected cash by Rp45.000 and Rp10.000.

## Consequence

The model does not write the financial prose. It returns structured claims. The server checks each claim against the calculator (the amount, the entry, the method or confirmation status, and the sign of the gap) and renders the Indonesian itself. What-if lines come from the calculator, one note at a time, and are never combined. If any claim is not proven, the AI text is discarded and the rule summary is shown, labeled as a rule summary.
