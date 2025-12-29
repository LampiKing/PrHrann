const appJson = require("./app.json");

const season = (process.env.PRHRAN_SEASON || "default").toLowerCase();
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
