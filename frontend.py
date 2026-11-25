from pathlib import Path

import streamlit as st
import pdfplumber
import docx2txt as docx
import pandas as pd
from backend import kiril_to_lotin, kiril_to_uzbek, lotin_to_kiril, lotin_to_uzbek, uzbek_to_lotin

st.set_page_config(
    page_title="Alifbo o‘zgartirgich",
    page_icon="🔤",
    layout="wide"
)

st.markdown(
    """
    <style>
    .st-key-output_text textarea {
        font-family: inherit !important;
        font-size: 18px !important;
        line-height: 1.5 !important;
        height: 250px !important;
    }

    .st-key-output_text label {
        font-size: 16px !important;
    }
    </style>
    """,
    unsafe_allow_html=True
    )

st.title("Alifbo o‘zgartirgich")
st.write("O‘zbekcha matnlarni turli alifbolarga o‘zgartiring")


col1, middle_col, col2 = st.columns([1, 0.5, 1])

if "source" not in st.session_state:
    st.session_state.source = "Kiril O‘zbek"

if "target" not in st.session_state:
    st.session_state.target = "Lotin O‘zbek"

def swap_languages():
    st.session_state.source, st.session_state.target = (
        st.session_state.target,
        st.session_state.source
    )

def file_import(upload_file, source, target):
    if upload_file is None:
        st.write("Yoki fayl yuklang.")
        return
    else:
        st.write(upload_file.type)
        if upload_file.type == 'text/plain':

            #Read the uploaded file
            file_content = upload_file.getvalue().decode('utf-8')

            #Convert the text
            if source == target:
                converted_text = file_content

            else:
                converter = converters.get((source, target))

                if converter:
                    converted_text = converter(file_content)
                else:
                    st.error("Bu yo'nalish qo'llab quvvatlanmaydi.")
                    return
            st.download_button(
                label='Yuklab olish', 
                data=converted_text, 
                file_name=f'{Path(upload_file.name).stem}_converted.txt',
                mime='text/plain'
            )
#pdf need fixing
        # elif upload_file.type == 'application/pdf':
        #     with pdfplumber.open(upload_file) as pdf:
        #         file_content = '\n'.join(page.extract_text() or '' for page in pdf.pages)

        #     #Convert the text
        #     if source == target:
        #         converted_text = file_content

        #     else:
        #         converter = converters.get((source, target))

        #         if converter:
        #             converted_text = converter(file_content)
        #         else:
        #             st.error("Bu yo'nalish qo'llab quvvatlanmaydi.")
        #             return
        #     st.download_button(
        #         label='Yuklab olish', 
        #         data=converted_text, 
        #         file_name=f'{Path(upload_file.name).stem}_converted.pdf',
        #         mime='application/pdf'
        #     )
        elif upload_file.type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            file_content = docx.process(upload_file) 
            #Convert the text
            if source == target:
                converted_text = file_content

            else:
                converter = converters.get((source, target))

                if converter:
                    converted_text = converter(file_content)
                else:
                    st.error("Bu yo'nalish qo'llab quvvatlanmaydi.")
                    return   
            st.download_button(
                label='Yuklab olish', 
                data=converted_text, 
                file_name=f'{Path(upload_file.name).stem}_converted.docx',
                mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
        elif upload_file.type == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            df = pd.read_excel(upload_file, dtype=str)
            df.fillna('')
            file_content = df.to_string(index=False)
            #Convert the text
            if source == target:
                converted_text = file_content

            else:
                converter = converters.get((source, target))

                if converter:
                    converted_text = converter(file_content)
                else:
                    st.error("Bu yo'nalish qo'llab quvvatlanmaydi.")
                    return   
            st.download_button(
                label='Yuklab olish', 
                data=converted_text, 
                file_name=f'{Path(upload_file.name).stem}_converted.xlsx',
                mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        else:
            st.error("Bu fayl turi qo'llab quvvatlanmaydi")
            return
    
with col1:
    source = st.selectbox(
        "Shu alifbodan:",
        [
            "Kiril O‘zbek",
            "Lotin O‘zbek",
            "Yangi O‘zbek"
        ],
        key='source'
    )

with middle_col:
    st.write("")
    st.write("")
    st.button("⇄", help='Alifbolarni almashtirish', on_click=swap_languages)

with col2:
    target = st.selectbox(
        "Shu alifboga:",
        [
            "Kiril O‘zbek",
            "Lotin O‘zbek",
            "Yangi O‘zbek"
        ],
        key='target'
    )


converters = {
    ("Kiril O‘zbek", "Lotin O‘zbek"): kiril_to_lotin,

    ("Lotin O‘zbek", "Kiril O‘zbek"): lotin_to_kiril,

    ("Lotin O‘zbek", "Yangi O‘zbek"): lotin_to_uzbek,

    ("Yangi O‘zbek", "Lotin O‘zbek"): uzbek_to_lotin,

    ("Kiril O‘zbek", "Yangi O‘zbek"): kiril_to_uzbek,

    ("Yangi O‘zbek", "Kiril O‘zbek"):
        lambda text: lotin_to_kiril(uzbek_to_lotin(text))
}


live_text_area = st.components.v2.component(
    name="uzbek_live_text_area",

    html="""
        <label for="live-input">Matnni kiriting:</label>
        <textarea
            id="live-input"
            placeholder="Matn shu yerga kiritiladi..."
        ></textarea>
    """,

    css="""
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--st-text-color);
        }

        textarea {
            box-sizing: border-box;
            display: block;
            width: 100%;
            height: 250px;
            padding: 12px;
            resize: none;
            overflow-y: auto;
            font-family: inherit;
            font-size: 18px;
            line-height: 1.5;
            color: var(--st-text-color);
            background: var(--st-bg-color);
            border: 1px solid var(--st-border-color);
            border-radius: 8px;
        }
    """,
    js="""
        export default function({ parentElement, setStateValue }) {
            const textarea = parentElement.querySelector("#live-input");

            textarea.oninput = () => {
                setStateValue("text", textarea.value);
            };
        }
    """
)


with col1:
    input_result = live_text_area(
        default={"text": ""},
        on_text_change=lambda: None,
        key="live_input",
        height=300,
        width="stretch"
    )

    input_text = input_result.text or ""

with middle_col:
    uploaded_file = st.file_uploader("Fayl yuklash", accept_multiple_files=False, type=["txt", 'pdf', 'csv', 'xlsx', 'docx'], key="file_upload", on_change=lambda: None)
    if uploaded_file:
        file_import(uploaded_file, source, target)

with col2:
    if source == target:
        converted_text = input_text

    else:
        converter = converters.get((source, target))

        if converter:
            converted_text = converter(input_text)
        else:
            converted_text = ""

    st.text_area(
        "O‘zgartirilgan matn:",
        value=converted_text,
        height=250,
        disabled=True
    )