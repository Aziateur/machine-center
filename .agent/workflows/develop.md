---
description: Machine Center development workflow — question-driven design
---

# Development Workflow

This is a question-driven product development process, inspired by Dalio's radical transparency and Musk's "question every requirement" principle.

## The Loop

Every development cycle follows this loop:

### 1. QUESTION (before building)
- Ask 3-8 targeted questions about the user's intent, design preferences, and priorities
- Questions should be about WHY and HOW, not just WHAT
- Focus on: experience feel, edge cases, what information matters most, what's annoying
- Never assume — always ask if uncertain about the user's mental model
- Frame questions around real usage scenarios, not abstract features

### 2. BUILD (after answers)
- Implement based on the answers
- Keep changes focused — one coherent chunk at a time
- Test in the browser before presenting to the user
- Take screenshots to show what was built

### 3. SHOW (after building)
- Present what was built with screenshots
- Highlight design decisions made and why
- Be transparent about tradeoffs and what's still rough

### 4. LISTEN (after showing)
- Let the user experience the app
- Ask: "What feels off? What's missing? What's annoying?"
- Don't defend decisions — adapt based on feedback
- Problems the user identifies ARE the next priorities

### 5. REPEAT
- Go back to step 1 with new questions informed by feedback

## Question Categories

When stuck on what to ask, use these categories:

- **Experience**: "When you open this, what should you feel? What should jump out first?"
- **Priority**: "What's more important: X or Y?"
- **Edge cases**: "What happens when Z?"
- **Mental model**: "How do you think about this? Is it more like A or B?"
- **Friction**: "What's the most annoying thing about this right now?"
- **First principles**: "Do we actually need this? What problem does it solve?"

## Principles

- The user is the designer. I am the engineer executing the designer's vision.
- Questions > assumptions. Always.
- Build modular — don't hardcode anything the user might want to change.
- Dalio: Pain + Reflection = Progress. When something feels wrong, diagnose why.
- Musk: Question every requirement, delete before optimizing.
