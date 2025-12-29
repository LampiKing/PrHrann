const appJson = require("./app.json");

const getSeasonFromDate = (date = new Date()) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 10) return "halloween";
  if (month === 11 && day >= 15) return "winter";
  if (month === 12) return "winter";
  return "default";
};

const season = (process.env.PRHRAN_SEASON || getSeasonFromDate()).toLowerCase();
const seasonalLogos = {
  default: "./assets/images/Logo Default.png",
  halloween: "./assets/images/Logo Halloween.png",
  winter: "./assets/images/Logo Bozicni.png",
};

const seasonalLogo = seasonalLogos[season] || seasonalLogos.default;

const config = {
  ...appJson,
  expo: {
    ...appJson.expo,
    icon: seasonalLogo,
    android: {
      ...appJson.expo.android,
      adaptiveIcon: {
        ...(appJson.expo.android ? appJson.expo.android.adaptiveIcon : {}),
        foregroundImage: seasonalLogo,
      },
    },
    web: {
      ...appJson.expo.web,
      favicon: seasonalLogo,
    },
  },
};

const plugins = [...(config.expo.plugins || [])];
const splashIndex = plugins.findIndex(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen"
);

if (splashIndex !== -1) {
  const splashConfig = { ...(plugins[splashIndex][1] || {}) };
  splashConfig.image = seasonalLogo;
  splashConfig.imageWidth = splashConfig.imageWidth ?? 200;
  splashConfig.resizeMode = splashConfig.resizeMode ?? "contain";
  splashConfig.backgroundColor = splashConfig.backgroundColor ?? "#FAFAFA";
  plugins[splashIndex] = ["expo-splash-screen", splashConfig];
}

config.expo.plugins = plugins;

module.exports = config;
