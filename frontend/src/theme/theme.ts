const commonColors = {
  white: "#FFFFFF",
  black: "#000000",
  danger: "#EF4444",
  success: "#22C55E",
};

const lightTheme = {
  colors: {
    ...commonColors,
    background: "#FFFFFF",
    text: "#000000",
    primary: "#001E4F",
    secondary: "#EC5900",
    navy0: "#FFFFFF",
    navy100: "#D2DCFF",
    navy200: "#A9BCFE",
    navy300: "#759BFF",
    navy400: "#2F7BFE",
    navy500: "#005FD0",
    navy600: "#00459D",
    navy700: "#002D6A",
    navy800: "#001E4F",
    navy900: "#001233",
    orange50: "#FFF0EE",
    orange100: "#FFE5E2",
    orange200: "#FECBC4",
    orange300: "#FFAC9D",
    orange400: "#FF8F75",
    orange500: "#FF6E3F",
    orange600: "#EC5900",
    orange700: "#B34000",
    orange800: "#782801",
    orange900: "#441301",
    gray50: "#E5E5E5",
    gray100: "#CFCFCF",
    gray200: "#B6B6B6",
    gray300: "#A0A0A0",
    gray400: "#A0A0A0",
    gray500: "#898989",
    gray600: "#6D6D6D",
    gray700: "#505050",
    gray800: "#373737",
    gray900: "#1D1D1D"
  },
};

const darkTheme = {
  colors: {
    ...commonColors,
    background: "#111827",
    text: "#F9FAFB",
    primary: "#AFCEFF",
    secondary: "#FF6208",
    navy0: "#0D0D0D",
    navy100: "#000E45",
    navy200: "#00186F",
    navy300: "#759AFF",
    navy400: "#498BFF",
    navy500: "#0069EA",
    navy600: "#004FB7",
    navy700: "#003783",
    navy800: "#AFCEFF",
    navy900: "#CCDEFF",
    orange50: "#151515",
    orange100: "#1B1B1B",
    orange200: "#550B00",
    orange300: "#7B1300",
    orange400: "#FF8F76",
    orange500: "#FF8259",
    orange600: "#FF6208",
    orange700: "#CD4800",
    orange800: "#913100",
    orange900: "#FFCEBA",
    gray50: "#191919",
    gray100: "#272727",
    gray200: "#3D3D3D",
    gray300: "#B6B6B6",
    gray400: "#A0A0A0",
    gray500: "#898989",
    gray600: "#6D6D6D",
    gray700: "#505050",
    gray800: "#373737",
    gray900: "#E2E2E2"
  },
};

const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export const getActiveThemeColors = (mode: "light" | "dark") => {
  return themes[mode].colors;
};