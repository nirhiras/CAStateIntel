#!/usr/bin/env python3
import os, re, time, requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://projecttracking.technology.ca.gov/PAL",
}
OUT_DIR = "./PAL_PDFs"

DOCS = [
    ("3940-105","Water Technical Access Portal (WaterTAP)","Stage 3 Solutions Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=156faf45-0be2-4c1c-b777-3b35d7e15c2a&projectid=3940-105"),
    ("3940-105","Water Technical Access Portal (WaterTAP)","Stage 2 Alternative Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=ce205c8d-d03e-4be0-af60-0348f07557e1&projectid=3940-105"),
    ("3940-105","Water Technical Access Portal (WaterTAP)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=15cd12ab-0e93-42ff-bb88-ea477407c5b4&projectid=3940-105"),
    ("2660-546","California Advanced Transportation Management System (CATMS)","Stage 3 Solution Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=3824fb97-44cc-4077-872f-53765e0db78c&projectid=2660-546"),
    ("2660-546","California Advanced Transportation Management System (CATMS)","Stage 2 Alternatives Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=23909d4f-81f3-42d5-85c2-5d67d92b0e1d&projectid=2660-546"),
    ("2660-546","California Advanced Transportation Management System (CATMS)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=e339080d-f121-4ebd-a86e-69abf540ae8f&projectid=2660-546"),
    ("2660-547","Enterprise Data Governance Technology Solution (EDGTS)","Stage 3 Solutions Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=5ee67f4d-19f4-4a80-944d-33d4597336fc&projectid=2660-547"),
    ("2660-547","Enterprise Data Governance Technology Solution (EDGTS)","Stage 2 Alternatives Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=2b0f8e3c-4980-495f-9c24-02fce9d9495e&projectid=2660-547"),
    ("2660-547","Enterprise Data Governance Technology Solution (EDGTS)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=22f385a1-6bb7-4d6e-b255-6f5f0d92d365&projectid=2660-547"),
    ("4265-081","Centralized Application Branch Online Project (CAB Online)","Stage 3 Solutions Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=b4b3e1d0-c00e-41a3-a099-4cfeb2ff94a4&projectid=4265-081"),
    ("4265-081","Centralized Application Branch Online Project (CAB Online)","Stage 2 Alternative Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=d86003e2-62bb-493e-b001-380ac85cc058&projectid=4265-081"),
    ("4265-081","Centralized Application Branch Online Project (CAB Online)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=2c1a6d0c-01d9-4e71-be5b-a6cd57cd9e88&projectid=4265-081"),
    ("1115-002","Laboratory Information Management System Replacement (LIMSR)","Stage 3 Solutions Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=02e24762-c8e7-456f-bde1-2c46648e7700&projectid=1115-002"),
    ("1115-002","Laboratory Information Management System Replacement (LIMSR)","Stage 2 Alternative Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=07c756d0-22cf-4651-a049-602713dfe53b&projectid=1115-002"),
    ("1115-002","Laboratory Information Management System Replacement (LIMSR)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=ee53a2a4-bee7-49d3-bdb1-05cfa4003a42&projectid=1115-002"),
    ("3480-052","Division of Mine Reclamation DMR SMARA-4","Stage 2 Alternatives Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=9cbbff50-8188-4d30-88c9-17586157d181&projectid=3480-052"),
    ("3480-052","Division of Mine Reclamation DMR SMARA-4","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=aded867b-b568-448d-ab55-f5f0e848e2d9&projectid=3480-052"),
    ("2670-002","BOPC Information Technology Modernization Project (ITMP)","Stage 3 Solutions Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=8457d3ef-8f5b-4967-af27-3139ab5d08c5&projectid=2670-002"),
    ("2670-002","BOPC Information Technology Modernization Project (ITMP)","Stage 2 Alternatives Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=25a6f820-5e0f-4b91-831e-2df2cba7691b&projectid=2670-002"),
    ("2670-002","BOPC Information Technology Modernization Project (ITMP)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=1b95464e-e4d9-4fb0-87ae-b8583645374e&projectid=2670-002"),
    ("0860-100","BOE IT Modernization (IT BOEM)","Stage 2 Alternative Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=1e361397-d379-42af-9ec2-0f0a7b06dd47&projectid=0860-100"),
    ("0860-100","BOE IT Modernization (IT BOEM)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=801182f9-399f-4c4e-bf7d-e4ba1f338596&projectid=0860-100"),
    ("7350-093","EAMS Modernization (EAMS)","Stage 3 Solution Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=589c8b9a-a75a-45f6-8301-3ebc02f09cf0&projectid=7350-093"),
    ("7350-093","EAMS Modernization (EAMS)","Stage 2 Alternative Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=77548c7a-6e8b-40b0-bb0f-4fc4ff2b9f82&projectid=7350-093"),
    ("7350-093","EAMS Modernization (EAMS)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=65a79630-9c9c-4aff-90ef-15bc9eecfd38&projectid=7350-093"),
    ("0820-228","Firearms IT Systems Modernization (FITSM)","Stage 2 Alternative Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=5ed2391a-0146-41f7-adcf-492607613298&projectid=0820-228"),
    ("0820-228","Firearms IT Systems Modernization (FITSM)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=14808ef2-83c0-4967-b660-4f20ab13a283&projectid=0820-228"),
    ("5180-227","California Supporting Providers and Reaching Kids (CalSPARK) Core","Stage 2 Alternative Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=5b7dc9fd-377c-4a4b-a9c0-0d00eae78ccd&projectid=5180-227"),
    ("5180-227","California Supporting Providers and Reaching Kids (CalSPARK) Core","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=e2f5cc7c-960a-4165-a2b8-a0c6c7fc6b0b&projectid=5180-227"),
    ("4300-064","Life Outcomes Improvement System (LOIS)","Stage 2 Alternatives Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=294b7de8-be1f-4191-aae5-cc8a37b17aed&projectid=4300-064"),
    ("4300-064","Life Outcomes Improvement System (LOIS)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=3b507e84-cb7a-489c-b350-8a08017dbcfa&projectid=4300-064"),
    ("2740-231","Mobile Drivers License Pilot (mDL)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=9e7b6039-cf3c-494e-9fc9-19cdc4016ace&projectid=2740-231"),
    ("4260-251","Advancing Interoperability and Prior Authorizations Project (AIPA)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=4617ab41-366f-48e6-b276-a1daf84eb1e6&projectid=4260-251"),
    ("0845-053","HR Human Capital Management Project (HR HCMP)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=124aa704-5e65-4fe7-bf66-492bb1481899&projectid=0845-053"),
    ("3860-093","SAP S4HANA Upgrade","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=f11fd873-9cbc-45c9-a924-efd68c81b93a&projectid=3860-093"),
    ("5180-233","CA Child Care Workforce Registry (CA CCWR)","Stage 1 Business Analysis","https://projecttracking.technology.ca.gov/Home/DownloadProposal?documentid=d8e86ba5-1c98-4d22-8704-dc78d52de270&projectid=5180-233"),
]

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    ok, fail = 0, 0
    for proj_num, proj_name, label, url in DOCS:
        safe = re.sub(r'[^\w\-]', '_', proj_name)[:45]
        folder = os.path.join(OUT_DIR, f"{proj_num}_{safe}")
        os.makedirs(folder, exist_ok=True)
        fname = label.replace(" ", "_") + ".pdf"
        fpath = os.path.join(folder, fname)
        if os.path.exists(fpath):
            print(f"  (exists) {proj_num} / {label}")
            continue
        print(f"Downloading {proj_num}: {label}...")
        try:
            r = requests.get(url, headers=HEADERS, timeout=60, stream=True)
            r.raise_for_status()
            with open(fpath, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)
            print(f"  OK {fname} ({os.path.getsize(fpath)//1024} KB)")
            ok += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            fail += 1
        time.sleep(0.8)
    print(f"\nDone. {ok} downloaded, {fail} failed.")
    print(f"Files in: {os.path.abspath(OUT_DIR)}")

if __name__ == "__main__":
    main()
