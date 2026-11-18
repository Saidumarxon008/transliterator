from builtins import len, print, range, zip
import pandas as pd
import re
import streamlit as st
from pathlib import Path

csv_path = Path(__file__).parent / "lotin_kiril_new.csv"
lotin_kiril_pd = pd.read_csv(csv_path)
kiril = [
    'А', 'а', 'Б', 'б', 'В', 'в', 'Г', 'г',
    'Д', 'д', 'Е', 'е', 'Ё', 'ё', 'Ж', 'ж',
    'З', 'з', 'И', 'и', 'Й', 'й', 'К', 'к',
    'Л', 'л', 'М', 'м', 'Н', 'н', 'О', 'о',
    'П', 'п', 'Р', 'р', 'С', 'с', 'Т', 'т',
    'У', 'у', 'Ф', 'ф', 'Х', 'х', 'Ц', 'ц',
    'Ч', 'ч', 'Ш', 'ш', 
    #'Ъ', 'ъ', 'Ь', 'ь',
    'Э', 'э', 'Ю', 'ю', 'Я', 'я',
    'Ў', 'ў', 'Қ', 'қ', 'Ғ', 'ғ', 'Ҳ', 'ҳ'
]

lotin = [
    'A', 'a', 'B', 'b', 'V', 'v', 'G', 'g',
    'D', 'd', 'E', 'e', 'Yo', 'yo', 'J', 'j',
    'Z', 'z', 'I', 'i', 'Y', 'y', 'K', 'k',
    'L', 'l', 'M', 'm', 'N', 'n', 'O', 'o',
    'P', 'p', 'R', 'r', 'S', 's', 'T', 't',
    'U', 'u', 'F', 'f', 'X', 'x', 'Ts', 'ts',
    'Ch', 'ch', 'Sh', 'sh',
    #"", "", "", "", 
    'E', 'e', 'Yu', 'yu', 'Ya', 'ya',
    "Oʻ", "o‘", "Q", "q", "Gʻ", "gʻ", "H", "h"
]

uzbek = [
    'A', 'a', 'B', 'b', 'V', 'v', 'G', 'g',
    'D', 'd', 'E', 'e', 'Yo', 'yo', 'J', 'j',
    'Z', 'z', 'I', 'i', 'Y', 'y', 'K', 'k',
    'L', 'l', 'M', 'm', 'N', 'n', 'O', 'o',
    'P', 'p', 'R', 'r', 'S', 's', 'T', 't',
    'U', 'u', 'F', 'f', 'X', 'x', 'Ts', 'ts',
    'Ç', 'ç', 'Ş', 'ş',
#    "", "", "", "", 
    'E', 'e', 'Yu', 'yu', 'Ya', 'ya',
    'Ö', 'ö', 'Q', 'q', 'Ğ', 'ğ', 'H', 'h'
]


test_cases = [
    ("Салом", "Salom"),
    ("Шаҳар", "Shahar"),
    ("Чой", "Choy"),
    ("Ўзбекистон", "Oʻzbekiston"),
    ("Ғалаба", "Gʻalaba"),
    ("Қалам", "Qalam"),
    ("Ҳаво", "Havo"),
    ("Ёшлик", "Yoshlik"),
    ("Яхши", "Yaxshi"),
    ("Юлдуз", "Yulduz"),
    ("ШАҲАР", "SHAHAR"),
    ("ЧИРОЙЛИ", "CHIROYLI"),
    ("ЎЗБЕКИСТОН", "OʻZBEKISTON"),
    ("Ғўза", "Gʻoʻza"),
    ("СҲ?", "SH?"),
    ("Китоб 123", "Kitob 123"),
    ("Салом, дунё!", "Salom, dunyo!"),
    ("АБВ abc", "ABV abc"),
    ("Компьютер", "Kompyuter"),
    ("Подъезд", "Podyezd"),
    ('аъзоларимиз', 'aʻzolarimiz'),
]

test_cases2 = [
    ("Salom", "Салом"),
    ("Shahar", "Шаҳар"),
    ("Choy", "Чой"),
    ("Oʻzbekiston", "Ўзбекистон"),
    ("Gʻalaba", "Ғалаба"),
    ("Qalam", "Қалам"),
    ("Havo", "Ҳаво"),
    ("Yoshlik", "Ёшлик"),
    ("Yaxshi", "Яхши"),
    ("Yulduz", "Юлдуз"),
    ("SHAHAR", "ШАҲАР"),
    ("CHIROYLI", "ЧИРОЙЛИ"),
    ("OʻZBEKISTON", "ЎЗБЕКИСТОН"),
    ( "Gʻoʻza", "Ғўза"),
    ("Kitob 123","Китоб 123"),
    ("Salom, dunyo!", "Салом, дунё!"),
    ("Kompyuter", "Компьютер"),
    ("Podyezd", "Подъезд"),
    ('aʻzolarimiz', 'аъзоларимиз'),
]


def kiril_to_lotin(text):
    text = re.sub(r"(?<=\s)Ц", 'S', text)
    text = re.sub(r"(?<=\s)ц", 's', text)
    text = re.sub('ъе', 'ye', text)
    text = re.sub(r'(?=\w)ъ', r'ʻ', text)
    text = re.sub(r'Ш(?=[А-ЯЁ])', 'SH', text)
    text = re.sub(r'Ч(?=[А-ЯЁ])', 'CH', text)
    text = re.sub(r'Я(?=[А-ЯЁ])', 'YA', text)
    text = re.sub(r'(?<=[А-ЯЁ])Я', 'YA', text)
    text = re.sub(r'Ц(?=[А-ЯЁ])', 'TS', text)
    text = re.sub(r'ь(?=\w)', '', text)
    for i in range(len(kiril)):
        text = text.replace(kiril[i], lotin[i])
    return text

def lotin_to_kiril(text):
    text = re.sub(r"\b(v|ob|ot|pod|raz|s)(ye|yo|yu|ya)", r"\1ъ\2", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(ad|diz|in|inter|kon|kontr|pan|sub|tran)(ye|yo|yu|ya)", r"\1ъ\2", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(kompyuter|premyera|karyera|intervyu|relyef|baryer|pavyon|medalyon|batalyon|bulon|shampinyon|pyesa|kuriyer|kuryer|atyelye|felyeton|vinyetka|minyatura|pavilyon|postalyon|shifonyer)(?=[a-zʻ]*\b)", lambda m: re.sub(r"([bcdfghjklmnpqrstvwxz])(y[aeiou])", r"\1ь\2", m.group(0), count=1, flags=re.IGNORECASE), text, flags=re.IGNORECASE)
    text = re.sub(r'\b(palto|albom|konsultatsiya|fakultet|asfalt|filtr|film|multfilm|kultura|impuls|rels|kalsiy|alpinist|buldog|buldozer|valyuta|devalvatsiya|emulsiya|falsifikatsiya|folklor|golf|insult|katapulta|konsul|kult|melxior|multiplikatsiya|penalti|pult|rezultat|salto|ultimatum|ultraviyole|vulkan|zelts)(?=[a-zʻ’\']*\b)',lambda m: m.group(0).replace('l', 'lь', 1),text,flags=re.IGNORECASE)
    text = re.sub(r'\b(sentabr|oktabr|noyabr|dekabr|iyun|iyul|aprel|lager|rul|nol|rol|parol|shtempel|sekretar|inventar|kalendar|monastir|pechat|neft|oblast|seld|portfel|model|otel|kokteyl|festival|gospital|ansambl|spektakl|binokl|[a-z]{3,}(?:tel|ost))(?=[a-zʻ’\']*\b)',r'\1ь',text,flags=re.IGNORECASE)
    text = re.sub(r'\b(kon|pis|men|bol|svad|xod|molot|pros|rez)(ki|mo|shevik|ba|bu|ba)\b',r'\1ь\2',text,flags=re.IGNORECASE)
    text = re.sub('TS', 'Ц', text)
    text = re.sub('Ts', 'Ц', text)
    text = re.sub('ts', 'ц', text) 
    text = re.sub('Sh', 'Ш', text)
    text = re.sub('SH', 'Ш', text)
    text = re.sub('sh', 'ш', text)
    text = re.sub('Oʻ', 'Ў', text)
    text = re.sub('o‘', 'ў', text)
    text = re.sub('oʻ', 'ў', text)
    text = re.sub('Gʻ', 'Ғ', text)
    text = re.sub('gʻ', 'ғ', text)
    text = re.sub('Ya', 'Я', text)
    text = re.sub('Yu', 'Ю', text)
    text = re.sub('CH', 'Ч', text)
    text = re.sub('yu', 'ю', text)
    text = re.sub('ye', 'е', text)
    text = re.sub('ya', 'я', text)
    text = re.sub('YA', 'Я', text)
    text = re.sub('Ya', 'Я', text)
    text = re.sub('(?<=[a-z])ʻ', 'ъ', text)
    text = re.sub(r"\bE", "Э", text)
    text = re.sub(r"\be", "э", text)
    for i in range(len(lotin)):
        text = text.replace(lotin[i], kiril[i])
    return text

def lotin_to_uzbek(text):
    text = re.sub('Sh', 'Ş', text)
    text = re.sub('SH', 'Ş', text)
    text = re.sub('sh', 'ş', text)  
    text = re.sub('CH', 'Ç', text)
    text = re.sub('Ch', 'Ç', text)
    text = re.sub('ch', 'ç', text)
    text = re.sub('oʻ', 'ö', text)
    for i in range(len(uzbek)):
        text = text.replace(lotin[i], uzbek[i])
    return text

def uzbek_to_lotin(text):
    text = re.sub(r'Ş(?=[A-Z])', 'SH', text)
    text = re.sub(r'Ç(?=[A-Z])', 'CH', text)
    for i in range(len(uzbek)):
        text = text.replace(uzbek[i], lotin[i])
    return text

def kiril_to_uzbek(text):
    text = re.sub(r"(?<=\s)Ц", 'S', text)
    text = re.sub(r"(?<=\s)ц", 's', text)
    text = re.sub('ъе', 'ye', text)
    text = re.sub(r'(?=\w)ъ', r'ʻ', text)
    text = re.sub(r'Ш(?=[А-ЯЁ])', 'Ş', text)
    text = re.sub(r'Ч(?=[А-ЯЁ])', 'Ç', text)
    text = re.sub(r'Я(?=[А-ЯЁ])', 'YA', text)
    text = re.sub(r'(?<=[А-ЯЁ])Я', 'YA', text)
    text = re.sub(r'Ц(?=[А-ЯЁ])', 'TS', text)
    text = re.sub(r'ь(?=\w)', '', text)
    for i in range(len(kiril)):
        text = text.replace(kiril[i], uzbek[i])
    return text
def test_engine(data, function, input_column, expected_column):
    for input_text, expected in zip(data[input_column], data[expected_column]):
        actual = function(input_text)
        if actual == expected:
            print("Pass:", actual)
            pass
        else:
            print("FAIL:", input_text)
            print("Expected:", expected)
            print("Got:", actual)

# -------------------------------
# 1. PAGE SETTINGS
# -------------------------------

st.set_page_config(
    page_title="Alifbo o‘zgartirgich",
    page_icon="🔤",
    layout="wide"
)


# -------------------------------
# 2. PAGE TITLE
# -------------------------------

st.title("Alifbo o‘zgartirgich")
st.write("O‘zbekcha matnlarni turli alifbolarga o‘zgartiring")


# -------------------------------
# 3. SELECT SOURCE AND TARGET
# -------------------------------

source = st.selectbox(
    "Convert from:",
    [
        "Kiril O‘zbek",
        "Lotin O‘zbek",
        "Yangi O‘zbek"
    ]
)

target = st.selectbox(
    "Convert to:",
    [
        "Kiril O‘zbek",
        "Lotin O‘zbek",
        "Yangi O‘zbek"
    ]
)


# -------------------------------
# 4. CONNECT THE CONVERSION FUNCTIONS
# -------------------------------

converters = {
    ("Kiril O‘zbek", "Lotin O‘zbek"): kiril_to_lotin,

    ("Lotin O‘zbek", "Kiril O‘zbek"): lotin_to_kiril,

    ("Lotin O‘zbek", "Yangi O‘zbek"): lotin_to_uzbek,

    ("Yangi O‘zbek", "Lotin O‘zbek"): uzbek_to_lotin,

    ("Kiril O‘zbek", "Yangi O‘zbek"): kiril_to_uzbek,

    ("Yangi O‘zbek", "Kiril O‘zbek"):
        lambda text: lotin_to_kiril(uzbek_to_lotin(text))
}


# -------------------------------
# 5. INPUT AND OUTPUT AREAS
# -------------------------------

left, right = st.columns(2)

with left:
    input_text = st.text_area(
        "Matnni kiriting:",
        height=250,
        placeholder="Matn shu yerga kiritiladi..."
    )

with right:
    output_area = st.empty()


# -------------------------------
# 6. CONVERT BUTTON
# -------------------------------

if st.button("Convert", type="primary"):

    if not input_text:
        st.warning("Iltimos, matn kiriting")

    elif source == target:
        converted_text = input_text
        output_area.text_area(
            "O‘zgartirilgan matn:",
            value=converted_text,
            height=250
        )

    else:
        converter = converters.get((source, target))

        if converter:
            converted_text = converter(input_text)

            output_area.text_area(
                "Converted text:",
                value=converted_text,
                height=250
            )

        else:
            st.error("Matnni o‘zgartirib bo‘lmadi.")