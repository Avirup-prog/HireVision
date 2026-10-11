with open('frontend/src/pages/CandidateProfile.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
tabs = re.findall(r"activeTab === '([^']+)'", text)
print('Tabs found in CandidateProfile.jsx:', set(tabs))

nav_matches = re.findall(r"setActiveTab\('([^']+)'\)", text)
print('setActiveTab calls:', set(nav_matches))
