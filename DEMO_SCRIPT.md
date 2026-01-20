# AI Lead Qualifier - Demo Script

This script helps you demonstrate the AI lead qualification system. Follow these responses when the AI agent calls you.

---

## Demo Scenario: Hot Lead (Score: 85+)

**Character:** Sarah Chen, VP of Sales at TechFlow Solutions
**Company Size:** 51-200 employees
**Initial Request:** "Need an AI solution to handle inbound lead qualification and scheduling"

### The Call Script

**AI:** "Hello, is this Sarah? Hi Sarah, this is an AI assistant calling about your recent inquiry regarding an AI solution for lead qualification and scheduling. Do you have a few minutes to chat?"

**YOU:** "Yes, this is Sarah. I've been expecting your call. I have about 5 minutes."

---

**AI:** *(Asks about motivation/pain points)*

**YOU:** "We're drowning in leads right now. Our sales team spends 60% of their time qualifying leads that go nowhere. We need to automate this so our reps can focus on closing deals. We're losing deals because we can't respond fast enough."

---

**AI:** *(Asks about current tools/new initiative)*

**YOU:** "We've tried a few chatbots but they felt robotic and turned people off. We want something that sounds natural and can actually have a real conversation, not just collect form data."

---

**AI:** *(Asks about budget)*

**YOU:** "We've allocated $15,000 to $25,000 annually for this. It's already approved by our CFO. If it works well, we can expand the budget next quarter."

---

**AI:** *(Asks about decision maker/authority)*

**YOU:** "I'm the final decision maker for sales tools. Our CTO will want to review the technical integration, but if I say yes, we move forward."

---

**AI:** *(Asks about timeline)*

**YOU:** "We need this implemented within 2 weeks. We have a big trade show in 3 weeks and we're expecting a surge of leads. This is urgent."

---

**AI:** *(Wraps up the call)*

**YOU:** "Thank you. I'm looking forward to hearing more. Please have someone reach out today if possible."

---

### Expected Qualification Result

| Factor | Response | Score |
|--------|----------|-------|
| **Budget** | $15K-25K approved | 25/25 |
| **Authority** | Final decision maker | 25/25 |
| **Need** | Clear pain point, tried alternatives | 25/25 |
| **Timeline** | 2 weeks, urgent | 20/25 |
| **TOTAL** | | **95/100** |

**Classification:** 🔥🔥 **HOT LEAD**

---

## Demo Scenario: Warm Lead (Score: 60-75)

**Character:** Mike Rodriguez, Operations Manager at GrowthCo
**Company Size:** 11-50 employees
**Initial Request:** "Exploring AI options for customer outreach"

### The Call Script

**AI:** "Hello, is this Mike?..."

**YOU:** "Yeah, that's me. What's this about?"

---

**AI:** *(Asks about motivation)*

**YOU:** "We're growing fast and need to scale our outreach. Right now it's all manual and we can't keep up."

---

**AI:** *(Asks about current tools)*

**YOU:** "We're using basic email automation but nothing sophisticated. This would be new territory for us."

---

**AI:** *(Asks about budget)*

**YOU:** "Honestly, we haven't set a specific budget yet. I'm trying to understand what options are out there and what things cost first."

---

**AI:** *(Asks about decision maker)*

**YOU:** "I'll need to run this by our CEO. She makes the final call on new software purchases. But she trusts my recommendations."

---

**AI:** *(Asks about timeline)*

**YOU:** "No huge rush. Maybe implement something in the next quarter or so. We're still in research mode."

---

### Expected Qualification Result

| Factor | Response | Score |
|--------|----------|-------|
| **Budget** | Not set, exploring | 10/25 |
| **Authority** | Influencer, needs CEO approval | 15/25 |
| **Need** | Clear need, scaling issue | 20/25 |
| **Timeline** | Next quarter, no rush | 15/25 |
| **TOTAL** | | **60/100** |

**Classification:** 🟡 **WARM LEAD**

---

## Demo Scenario: Cold Lead (Score: 30-40)

**Character:** Jordan Taylor, Intern at StartupXYZ
**Company Size:** 1-10 employees
**Initial Request:** "Just curious about AI tools"

### The Call Script

**AI:** "Hello, is this Jordan?..."

**YOU:** "Uh, yeah. Who is this?"

---

**AI:** *(Asks about motivation)*

**YOU:** "Oh, I was just browsing and filled out a form. I'm doing research for a school project on AI in business."

---

**AI:** *(Asks about current tools/situation)*

**YOU:** "I'm actually an intern here. I don't really know what tools the company uses."

---

**AI:** *(Asks about budget)*

**YOU:** "I have no idea. I wouldn't be involved in anything like that."

---

**AI:** *(Asks about decision maker)*

**YOU:** "No, definitely not me. I just answer phones and do filing mostly."

---

**AI:** *(Asks about timeline)*

**YOU:** "I don't think the company is looking for anything right now. Like I said, I was just curious."

---

### Expected Qualification Result

| Factor | Response | Score |
|--------|----------|-------|
| **Budget** | No knowledge | 5/25 |
| **Authority** | No authority (intern) | 5/25 |
| **Need** | No real need, research only | 5/25 |
| **Timeline** | No timeline | 5/25 |
| **TOTAL** | | **20/100** |

**Classification:** ❄️ **COLD LEAD**

---

## Quick Reference: Key Phrases

### For HOT leads (high score):
- "We've already allocated budget"
- "I'm the decision maker"
- "We need this ASAP / within 2 weeks"
- "We've tried X and it didn't work, we need something better"
- "This is a top priority for us"

### For WARM leads (medium score):
- "We're still figuring out budget"
- "I need to run this by my manager/CEO"
- "Sometime in the next quarter"
- "We're exploring options"
- "Interested but not urgent"

### For COLD leads (low score):
- "Just browsing / doing research"
- "I'm not the right person to talk to"
- "We're not really looking right now"
- "I have no idea about budget"
- "Maybe someday in the future"

---

## Demo Flow

1. **Open Frontend:** http://localhost:5173
2. **Fill out the lead form** with demo character info
3. **Answer the phone** when it rings
4. **Follow the script** based on which scenario you want to demonstrate
5. **Check the dashboard** to see the qualification results

---

## URLs

- **Frontend (Lead Form + Dashboard):** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **Leads API:** http://localhost:3000/api/leads
