import sys
import subprocess

def install(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.enum.text import PP_ALIGN
    from pptx.dml.color import RGBColor
except ImportError:
    install('python-pptx')
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.enum.text import PP_ALIGN
    from pptx.dml.color import RGBColor

prs = Presentation()

# Use a blank slide layout for a custom one-pager look
blank_slide_layout = prs.slide_layouts[5] 
slide = prs.slides.add_slide(blank_slide_layout)

# 1. Title
title_shape = slide.shapes.title
title_shape.text = "Journeyworks: Next-Generation Customer Intelligence"
title_shape.text_frame.paragraphs[0].font.size = Pt(32)

# subtitle
txBox = slide.shapes.add_textbox(Inches(0.5), Inches(1.2), Inches(9), Inches(0.5))
tf = txBox.text_frame
p = tf.add_paragraph()
p.text = "Transforming customer journey data into actionable, trustworthy AI insights on GCP."
p.font.size = Pt(18)
p.font.italic = True
p.font.color.rgb = RGBColor(0x59, 0x59, 0x59)

# 2. Challenge & Solution
txBox2 = slide.shapes.add_textbox(Inches(0.5), Inches(2.0), Inches(4.2), Inches(2.5))
tf2 = txBox2.text_frame
tf2.word_wrap = True

p_chal = tf2.add_paragraph()
p_chal.text = "The Challenge: The Customer Insight Gap"
p_chal.font.bold = True
p_chal.font.size = Pt(16)

p_chal_c = tf2.add_paragraph()
p_chal_c.text = "Organizations are drowning in data but starving for insights. Traditional platforms are slow and require technical expertise to query."
p_chal_c.font.size = Pt(12)

p_sol = tf2.add_paragraph()
p_sol.text = "\nThe Solution: Journeyworks"
p_sol.font.bold = True
p_sol.font.size = Pt(16)

p_sol_c = tf2.add_paragraph()
p_sol_c.text = "An enterprise-grade, agentic AI platform natively on GCP. It replaces static dashboards with autonomous AI that dynamically reasons through and analyzes complex journeys."
p_sol_c.font.size = Pt(12)

# 3. Key Capabilities
txBox3 = slide.shapes.add_textbox(Inches(5.0), Inches(2.0), Inches(4.5), Inches(4.0))
tf3 = txBox3.text_frame
tf3.word_wrap = True

p_cap = tf3.add_paragraph()
p_cap.text = "Key 'Wow' Capabilities"
p_cap.font.bold = True
p_cap.font.size = Pt(16)

caps = [
    ("1. Agentic AI Customer Analysis", "Give the AI a goal (e.g., 'Diagnose churn increase'), and it autonomously investigates using RAG and iterative reasoning loops to synthesize millions of data points."),
    ("2. Explainable AI & Confidence Scoring", "Unlike generic AI that hallucinates, Journeyworks 'shows its work' with traceable Reasoning Steps and mathematically backed Confidence Scores."),
    ("3. Cloud-Native Agility & Scale (GCP)", "We strictly optimize ROI using a flexible, pay-as-you-go GCP model where compute instantly scales for heavy AI workloads and down to zero when idle.")
]

for title, desc in caps:
    p_t = tf3.add_paragraph()
    p_t.text = f"\n{title}"
    p_t.font.bold = True
    p_t.font.size = Pt(12)
    
    p_d = tf3.add_paragraph()
    p_d.text = desc
    p_d.font.size = Pt(11)

# 4. ROI & Ask
txBox4 = slide.shapes.add_textbox(Inches(0.5), Inches(5.0), Inches(9.0), Inches(1.5))
tf4 = txBox4.text_frame
tf4.word_wrap = True

p_roi = tf4.add_paragraph()
p_roi.text = "Strategic Business Value (ROI)"
p_roi.font.bold = True
p_roi.font.size = Pt(14)

p_roi_c = tf4.add_paragraph()
p_roi_c.text = "• Accelerated Decision Velocity: Reduce time-to-insight from weeks to seconds.\n• Optimized TCO: Efficient, managed GCP scaling ensures you only pay for what you use.\n• Proactive Churn Mitigation: Identify at-risk patterns before revenue is lost."
p_roi_c.font.size = Pt(11)

p_ask = tf4.add_paragraph()
p_ask.text = "\nNext Steps: Requesting approval to move to a 30-day proof-of-value Pilot in Q3 leveraging our secure GCP tenant."
p_ask.font.bold = True
p_ask.font.italic = True
p_ask.font.size = Pt(12)

# Save
output_path = "documentation/proposal/Journeyworks_Executive_Pitch.pptx"
prs.save(output_path)
print(f"Generated successfully at {output_path}")
