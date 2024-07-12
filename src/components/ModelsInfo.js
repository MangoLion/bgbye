// modelsInfo.js
const ModelsInfo = {
    bria: { 
        displayName: 'Bria RMBG1.4', 
        shortName: "Bria",
        sourceUrl: 'https://huggingface.co/briaai/RMBG-1.4', 
        apiUrlVar: 'REACT_APP_BRIA_URL'
    },
    inspyrenet: { 
        displayName: 'InSPyReNet', 
        shortName: "InSPyRe",
        sourceUrl: 'https://github.com/plemeri/transparent-background/tree/main', 
        apiUrlVar: 'REACT_APP_INSPYRENET_URL'
    },
    u2net: { 
        displayName: 'U2Net', 
        shortName: "U2Net",
        sourceUrl: 'https://github.com/OPHoperHPO/image-background-remove-tool#%EF%B8%8F-how-does-it-work', 
        apiUrlVar: 'REACT_APP_U2NET_URL'
    },
    tracer: { 
        displayName: 'Tracer-B7', 
        shortName: "Tracer",
        sourceUrl: 'https://github.com/OPHoperHPO/image-background-remove-tool#%EF%B8%8F-how-does-it-work', 
        apiUrlVar: 'REACT_APP_TRACER_URL'
    },
    basnet: { 
        displayName: 'BASNet', 
        shortName: "BASNet",
        sourceUrl: 'https://github.com/OPHoperHPO/image-background-remove-tool#%EF%B8%8F-how-does-it-work', 
        apiUrlVar: 'REACT_APP_BASNET_URL'
    },
    deeplab: { 
        displayName: 'DeepLabV3', 
        shortName: "DeepLab",
        sourceUrl: 'https://github.com/OPHoperHPO/image-background-remove-tool#%EF%B8%8F-how-does-it-work', 
        apiUrlVar: 'REACT_APP_DEEPLAB_URL'
    },
    u2net_human_seg: { 
        displayName: 'U2Net Human', 
        shortName: "U2Net🧍",
        sourceUrl: 'https://github.com/danielgatis/rembg?tab=readme-ov-file#models', 
        apiUrlVar: 'REACT_APP_U2NET_HUMAN_SEG_URL'
    },
    ormbg: { 
        displayName: 'Open RMBG',
        shortName: "ORMBG",
        sourceUrl: 'https://huggingface.co/schirrmacher/ormbg', 
        apiUrlVar: 'REACT_APP_ORMBG_URL'
    },
    'isnet-general-use': { 
        displayName: 'ISNET-DIS', 
        shortName: "DIS",
        sourceUrl: 'https://github.com/danielgatis/rembg?tab=readme-ov-file#models', 
        apiUrlVar: 'REACT_APP_ISNET_GENERAL_URL'
    },
    'isnet-anime': { 
        displayName: 'ISNET-Anime', 
        shortName: "Anime",
        sourceUrl: 'https://github.com/danielgatis/rembg?tab=readme-ov-file#models', 
        apiUrlVar: 'REACT_APP_ISNET_ANIME_URL'
    }
};

export default ModelsInfo;
