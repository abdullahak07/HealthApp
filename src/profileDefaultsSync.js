const key = "healthai-mvp-v1";
const version = "profile-31-97-moderate-v1";

const raw = localStorage.getItem(key);
if (raw) {
  try {
    const data = JSON.parse(raw);
    if (data.profileDefaultsVersion !== version) {
      data.profile = {
        ...data.profile,
        age: 31,
        sex: "male",
        heightCm: 188,
        weightKg: 97,
        activity: "moderate",
      };
      data.profileDefaultsVersion = version;
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // Keep the existing app fallback when stored data cannot be read.
  }
}
