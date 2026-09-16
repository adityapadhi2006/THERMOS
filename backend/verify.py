from urllib.request import urlopen
import json

data = json.load(urlopen("http://127.0.0.1:8000/events"))

event = data["events"][0]

print("EVENT KEYS:")
print(list(event.keys()))

print("\nFIRST EVENT:")
print(event)