#!/bin/bash
# Move the fixup commit right after 9d5b491 and mark it as fixup
sed -i '' -e '/^pick 0ee4f5d/d' "$1"
sed -i '' -e '/^pick 9d5b491/a\
fixup 0ee4f5d fix(rosetta): replace Stripe test keys to pass push protection
' "$1"
