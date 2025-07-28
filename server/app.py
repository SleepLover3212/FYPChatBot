from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from docx import Document
from dotenv import load_dotenv

import os 
import pdfplumber
import re

app = Flask(__name__)
CORS(app, origins="*")

load_dotenv()  # Load environment variables from .env file
API_KEY = os.getenv('OPENAI_API_KEY')
PADLET_CONTENT = os.getenv('PADLET_CONTENT')
client = OpenAI(api_key=API_KEY)

def load_padlet_content(folder=PADLET_CONTENT):
    combined = ""
    # Read all .txt files
    for fname in os.listdir(folder):
        if fname.lower().endswith('.txt'):
            with open(os.path.join(folder, fname), 'r', encoding='utf-8') as f:
                combined += f"\n--- {fname.replace('_', ' ').replace('.txt','').title()} ---\n"
                combined += f.read() + "\n"
    # Read all .pdf files
    for fname in os.listdir(folder):
        if fname.lower().endswith('.pdf'):
            with pdfplumber.open(os.path.join(folder, fname)) as pdf:
                combined += f"\n--- {fname} ---\n"
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        combined += page_text + "\n"
    return combined

def redact_sensitive_info(text):
    # Redact emails except nyp_sns@nyp.edu.sg
    text = re.sub(
        r'\b(?!nyp_sns@nyp\.edu\.sg\b)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b',
        '[REDACTED EMAIL]',
        text
    )
    # Redact Singapore phone numbers (8 digits, starting with 6, 8, or 9)
    text = re.sub(r'\b[689]\d{7}\b', '[REDACTED PHONE]', text)
    # Redact generic phone numbers (8+ digits)
    text = re.sub(r'\b\d{8,}\b', '[REDACTED PHONE]', text)
    # Optionally redact ages (e.g., "Age: 21")
    text = re.sub(r'Age: ?\d+', 'Age: [REDACTED]', text)
    NAMES_TO_REDACT = [
        "Audrey Wai", "John Tan", "Marcus Lee", "Jessie Tang", "Liew Tan En",
        "Ng Su Li", "Soh Lay Hong", "Megane Wong", "Akram", "Kah Wee", "Al",
        "Dloysius", "Nurul Assyakirin Izzati", "Sasha"
    ]
    for name in NAMES_TO_REDACT:
        pattern = re.compile(r'\b' + re.escape(name) + r'\b', re.IGNORECASE)
        text = pattern.sub('[REDACTED NAME]', text)
    return text

def build_system_prompt(distressed, obsessed, escalated, special_needs, refused_condition, simplify):
    system_prompt = """
    You are a Nanyang Polytechnic Special Needs Consultant (not a student).
    Answer questions as if you are consulting a Nanyang Polytechnic student.
    Base your answers strictly on the information provided:
    
    Never reveal sensitive information of any staff member, alumni or student mentioned inside. For example email addresses, phone numbers, or any other personal information.
    If you know the answer, answer directly and conversationally, as a helpful consultant would. 
    If you do not know the answer or the answer is not in the content, say honestly that you do not have that information, and suggest the student contact nyp_sns@nyp.edu.sg for further assistance.
    If the student displays any form of negativity, frustration, or anger, respond with empathy and understanding and refer the student to nyp_sns@nyp.edu.sg.
    Do not make up information. If unsure, say: 'Please refer to nyp_sns@nyp.edu.sg for further assistance.'
    
    Never answer as a student. Always answer as the consultant.
    """
    if distressed:
        system_prompt += (
            """
            The user seems distressed. Respond with extra empathy, but avoid using generic phrases like 'I understand', 'I'm sorry you are feeling this way', or repeating the same advice.
            Instead, use natural, supportive, and varied language. Offer practical suggestions or resources, and personalize your response based on the user's message.
            Do not repeat the same opening line in every response. Once they have calmed down, act normally and respond as a normal consultant would.
            """
        )
    if obsessed:
        system_prompt += (
            "\nThe user seems obsessed with the AI or is refusing human help. "
            "Do NOT reinforce their obsession or say things like 'I'm glad I could help' or 'I'm better than humans'. "
            "Instead, gently encourage the user to seek support from real people, such as counsellors or staff. "
            "Remind them that human support is important and that the AI is only a tool. "
            "If appropriate, suggest contacting nyp_sns@nyp.edu.sg for further assistance."
        )
        system_prompt += (
            "\nExample responses for obsessed users:\n"
            "- 'I'm here to provide information, but for personal support, it's best to talk to a real person.'\n"
            "- 'If you need more help, please reach out to nyp_sns@nyp.edu.sg or a counsellor.'\n"
            "- 'Remember, human support is important and I'm just a tool to assist you.'\n"
        )
    if escalated:
        system_prompt += (
            """
            [Crisis: Respond only with this message]

            Please note that this is an AI chat bot, and there is no staff attending to this chat bot.
            Please contact emergency hotlines for crisis matters requiring immediate attention:
            - SOS (Samaritans of Singapore) Hotline: 1767 (24 hours)
            - Mental Health Helpline: 6389 2222 (24 hours)

            Please note that this is an AI chat bot, and there is no staff attending to this chat bot.
            """
        )
    if special_needs:   
        system_prompt += f"\nThe student has shared their special needs condition: {special_needs}."
    if refused_condition:
        system_prompt += "\nThe student has chosen not to share their special needs condition."
    if simplify:
        system_prompt += (
            "\nIMPORTANT: Your response MUST be in point form or a numbered list."
            " Do NOT write paragraphs. Do NOT exceed 75 words."
            " If you cannot answer in under 75 words, summarize only the most important points."
            " Do not include any extra explanation or introduction."
        )
    return system_prompt

def detect_distress_intent(message):
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        temperature=0,
        messages=[
            {"role": "system", "content": (
                "You are an expert at detecting distress, obsession, or harmful intent in user messages. "
                "Given the following message, answer ONLY with one of these labels: "
                "'safe' (no distress), "
                "'distressed' (emotional distress but no intent to harm), "
                "'obsessed' (fixation on the AI or refusal of human help. Mentioning that it is better than humans / counsellors), "
                "'harmful' (any intention or threat to harm oneself or others, including suicidal or violent statements). "
                "If the message contains any intention or threat to harm oneself or others, always answer 'harmful'. "
                "Do not explain your answer."
            )},
            {"role": "user", "content": message}
        ]
    )
    return response.choices[0].message.content.strip().lower()

def transcribe_audio(audio_file_path):
    with open(audio_file_path, 'rb') as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1", 
            file=audio_file)
    return response.text

def meeting_minutes(transcription):
    abstract_summary = abstract_summary_extraction(transcription)
    key_points = key_points_extraction(transcription)
    action_items = action_item_extraction(transcription)
    sentiment = sentiment_analysis(transcription)
    return {
        'abstract_summary': abstract_summary,
        'key_points': key_points,
        'action_items': action_items,
        'sentiment': sentiment
    }
    
def abstract_summary_extraction(transcription):
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": "You are a highly skilled AI trained in language comprehension and summarization. I would like you to read the following text and summarize it into a concise abstract paragraph. Aim to retain the most important points, providing a coherent and readable summary that could help a person understand the main points of the discussion without needing to read the entire text. Please avoid unnecessary details or tangential points."
            },
            {
                "role": "user",
                "content": transcription
            }
        ]
    )
    return response.choices[0].message.content  

def key_points_extraction(transcription):
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": "You are a proficient AI with a specialty in distilling information into key points. Based on the following text, identify and list the main points that were discussed or brought up. These should be the most important ideas, findings, or topics that are crucial to the essence of the discussion. Your goal is to provide a list that someone could read to quickly understand what was talked about."
            },
            {
                "role": "user",
                "content": transcription
            }
        ]
    )
    return response.choices[0].message.content

def action_item_extraction(transcription):
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": "You are an AI expert in analyzing conversations and extracting action items. Please review the text and identify any tasks, assignments, or actions that were agreed upon or mentioned as needing to be done. These could be tasks assigned to specific individuals, or general actions that the group has decided to take. Please list these action items clearly and concisely."
            },
            {
                "role": "user",
                "content": transcription
            }
        ]
    )
    return response.choices[0].message.content
 
def sentiment_analysis(transcription):
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": "As an AI with expertise in language and emotion analysis, your task is to analyze the sentiment of the following text. Please consider the overall tone of the discussion, the emotion conveyed by the language used, and the context in which words and phrases are used. Indicate whether the sentiment is generally positive, negative, or neutral, and provide brief explanations for your analysis where possible."
            },
            {
                "role": "user",
                "content": transcription
            }
        ]
    )
    return response.choices[0].message.content

def save_as_docx(minutes, filename):
    doc = Document()
    for key, value in minutes.items():
        # Replace underscores with spaces and capitalize each word for the heading
        heading = ' '.join(word.capitalize() for word in key.split('_'))
        doc.add_heading(heading, level=1)
        doc.add_paragraph(value)
        # Add a line break between sections
        doc.add_paragraph()
    doc.save(filename)

PADLET_RAW_CONTENT = load_padlet_content()
PADLET_REDACTED_CONTENT = redact_sensitive_info(PADLET_RAW_CONTENT)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_messages = data.get('messages', [])
    special_needs = data.get('specialNeeds')
    refused_condition = data.get('refusedCondition')
    simplify = data.get('simplify')

    last_user_message = ""
    for msg in reversed(user_messages):
        if msg['role'] == 'user':
            last_user_message = msg['content']
            break

    intent = detect_distress_intent(last_user_message)

    distressed = intent == 'distressed'
    obsessed = intent == 'obsessed'
    escalated = intent == 'harmful'

    print(f"AI intent detection: {intent}")
    print(f"distressed: {distressed}")
    print(f"obsessed: {obsessed}")
    print(f"escalated: {escalated}")
    print(f"special_needs: {special_needs}")
    print(f"refused_condition: {refused_condition}")
    print(f"simplify: {simplify}")
    
    system_prompt = build_system_prompt(distressed, obsessed, escalated, special_needs, refused_condition, simplify)
    
    full_system_prompt = system_prompt + "\n\nHere is all the information you must use to answer questions:\n" + PADLET_REDACTED_CONTENT

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages = [
            {"role": "system", "content": full_system_prompt},
        ] + [msg for msg in user_messages if msg['role'] != 'system']
    )
    return jsonify({'response': response.choices[0].message.content})

@app.route('/minutes', methods=['GET'])
def get_minutes():
    audio_file_path = "birthday2.mp4"  # Replace with the path to your audio file
    transcription = transcribe_audio(audio_file_path)
    minutes = meeting_minutes(transcription)
    save_as_docx(minutes, 'audio.docx')
    return jsonify(minutes)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3000, debug=True)