# test_runner.py
import sys, json
from modules.pipeline import process_claim

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error":"Usage: python test_runner.py <input_json_file>"}))
        return
    with open(sys.argv[1],'r') as f:
        data = json.load(f)
    out = process_claim(data)
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    main()
