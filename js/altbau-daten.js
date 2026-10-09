'use strict';
// Erzeugt von art/blender/altbau_post.py – Bildpositionen der Altbau-Räume in 3D (Spiel-Einheiten 960 × 440)
const ALTBAU3D = {
 "lobby": {
  "anchors": {
   "Fenster": [
    555,
    68,
    118,
    111
   ],
   "Gemaelde": [
    397,
    68,
    105,
    122
   ],
   "Schluesselbrett": [
    83,
    144,
    104,
    56
   ],
   "Rezeption": [
    20,
    256,
    259,
    87
   ],
   "Klingel": [
    117,
    251,
    23,
    13
   ],
   "Zucker": [
    187,
    242,
    30,
    19
   ],
   "Uhr": [
    279,
    147,
    67,
    197
   ],
   "Uhrfenster": [
    299,
    239,
    25,
    58
   ],
   "Sofa": [
    438,
    256,
    205,
    89
   ],
   "Automat": [
    695,
    183,
    88,
    158
   ],
   "Zettel": [
    729,
    226,
    36,
    23
   ],
   "Tuer": [
    832,
    150,
    117,
    185
   ],
   "Teppich": [
    358,
    356,
    446,
    94
   ],
   "Falltuer": [
    505,
    301,
    116,
    321
   ],
   "Glas": [
    858,
    180,
    58,
    70
   ]
  },
  "points": {
   "chuck": [
    246.0,
    260.7
   ],
   "pendel": [
    311.2,
    241.6
   ],
   "ed": [
    928.0,
    333.8
   ],
   "fensterGlas0": [
    571.2,
    80.6
   ],
   "fensterGlas1": [
    655.5,
    169.5
   ],
   "teppich": [
    560.0,
    394.0
   ],
   "mond": [
    650.9,
    75.5
   ]
  },
  "variants": {
   "zucker_leer": {
    "src": "img/altbau/lobby_zucker_leer.jpg",
    "x": 190.0,
    "y": 238.0,
    "w": 27.0,
    "h": 26.0
   },
   "falltuer": {
    "src": "img/altbau/lobby_falltuer.jpg",
    "x": 342.0,
    "y": 284.0,
    "w": 480.0,
    "h": 156.0
   },
   "strom": {
    "src": "img/altbau/lobby_strom.jpg",
    "x": 700.0,
    "y": 215.0,
    "w": 78.0,
    "h": 65.0
   }
  },
  "sprites": {
   "pendel": {
    "src": "img/altbau/lobby_pendel.png",
    "x": 304.0,
    "y": 239.0,
    "w": 19.0,
    "h": 55.0,
    "pivot": [
     311.2,
     241.6
    ]
   }
  }
 },
 "labor": {
  "anchors": {
   "Tuer": [
    7,
    150,
    110,
    185
   ],
   "Tafel": [
    134,
    52,
    186,
    104
   ],
   "Regal": [
    132,
    208,
    195,
    96
   ],
   "GutOMat": [
    385,
    102,
    209,
    220
   ],
   "Regler": [
    447,
    277,
    30,
    30
   ],
   "Hebel": [
    587,
    179,
    50,
    111
   ],
   "Klo": [
    705,
    100,
    144,
    247
   ]
  },
  "points": {
   "kloBirne": [
    779.3,
    107.3
   ],
   "kloOben": [
    791.1,
    142.1
   ],
   "kloUnten": [
    787.9,
    346.5
   ],
   "funken": [
    300.0,
    342.3
   ],
   "neon": [
    788.5,
    61.1
   ],
   "klemme": [
    392.0,
    136.3
   ],
   "pol": [
    397.0,
    158.6
   ]
  },
  "variants": {
   "regler_gut": {
    "src": "img/altbau/labor_regler_gut.jpg",
    "x": 445.0,
    "y": 277.0,
    "w": 34.0,
    "h": 23.0
   },
   "zelle": {
    "src": "img/altbau/labor_zelle.jpg",
    "x": 366.0,
    "y": 214.0,
    "w": 36.0,
    "h": 48.0
   },
   "brot": {
    "src": "img/altbau/labor_brot.jpg",
    "x": 418.0,
    "y": 129.0,
    "w": 64.0,
    "h": 29.0
   }
  },
  "sprites": {
   "hebel": {
    "src": "img/altbau/labor_hebel.png",
    "x": 595.0,
    "y": 177.0,
    "w": 42.0,
    "h": 93.0,
    "pivot": [
     603.0,
     262.0
    ]
   }
  }
 },
 "gasthaus": {
  "anchors": {
   "Fenster": [
    473,
    59,
    135,
    121
   ],
   "Schild": [
    648,
    59,
    134,
    50
   ],
   "Kamin": [
    29,
    122,
    233,
    223
   ],
   "Kessel": [
    108,
    253,
    63,
    43
   ],
   "Uhr": [
    288,
    147,
    60,
    196
   ],
   "Uhrfenster": [
    305,
    240,
    23,
    57
   ],
   "Tisch": [
    384,
    282,
    271,
    65
   ],
   "Obstschale": [
    452,
    259,
    32,
    29
   ],
   "Tuer": [
    833,
    110,
    117,
    225
   ]
  },
  "points": {
   "grail": [
    226.0,
    186.0
   ],
   "grog": [
    404.0,
    288.3
   ],
   "kessel": [
    139.9,
    252.1
   ],
   "feuer": [
    148.0,
    334.9
   ],
   "fensterGlas0": [
    486.1,
    72.0
   ],
   "fensterGlas1": [
    594.9,
    172.0
   ]
  },
  "variants": {
   "apfel": {
    "src": "img/altbau/gasthaus_apfel.jpg",
    "x": 444.0,
    "y": 242.0,
    "w": 48.0,
    "h": 51.0
   }
  },
  "sprites": {
   "pendel": {
    "src": "img/altbau/gasthaus_pendel.png",
    "x": 308.0,
    "y": 239.0,
    "w": 19.0,
    "h": 55.0,
    "pivot": [
     316.8,
     241.5
    ]
   }
  }
 },
 "garten1776": {
  "anchors": {
   "Tuer": [
    3,
    148,
    113,
    196
   ],
   "Zaun": [
    343,
    242,
    367,
    60
   ],
   "Brunnen": [
    187,
    143,
    156,
    195
   ],
   "Eimer": [
    310,
    253,
    24,
    22
   ],
   "Beet": [
    477,
    363,
    154,
    21
   ],
   "Klo": [
    727,
    77,
    180,
    264
   ],
   "Wegweiser": [
    901,
    230,
    74,
    128
   ]
  },
  "points": {
   "kloBirne": [
    812.1,
    82.7
   ],
   "kloOben": [
    829.5,
    143.6
   ],
   "kloUnten": [
    826.0,
    340.8
   ],
   "sonne": [
    200.0,
    68.0
   ],
   "wasser": [
    270.4,
    272.0
   ],
   "beet": [
    550.0,
    374.0
   ],
   "zaunVogel0": [
    376.0,
    247.0
   ],
   "zaunVogel1": [
    478.0,
    247.0
   ],
   "zaunVogel2": [
    640.0,
    247.0
   ]
  },
  "variants": {
   "eimer_weg": {
    "src": "img/altbau/garten1776_eimer_weg.jpg",
    "x": 304.0,
    "y": 238.0,
    "w": 36.0,
    "h": 42.0
   },
   "beet1": {
    "src": "img/altbau/garten1776_beet1.jpg",
    "x": 519.0,
    "y": 359.0,
    "w": 98.0,
    "h": 21.0
   },
   "beet2": {
    "src": "img/altbau/garten1776_beet2.jpg",
    "x": 519.0,
    "y": 356.0,
    "w": 62.0,
    "h": 24.0
   },
   "beet3": {
    "src": "img/altbau/garten1776_beet3.jpg",
    "x": 519.0,
    "y": 312.0,
    "w": 62.0,
    "h": 68.0
   }
  },
  "sprites": {}
 },
 "fgarten": {
  "anchors": {
   "Klo": [
    52,
    114,
    165,
    228
   ],
   "Statue": [
    291,
    98,
    114,
    241
   ],
   "Baumplatz": [
    610,
    345,
    191,
    21
   ],
   "Baum": [
    542,
    22,
    353,
    339
   ],
   "Laterne": [
    487,
    -7,
    116,
    364
   ],
   "Palast": [
    848,
    -27,
    276,
    370
   ],
   "Wegweiser": [
    -13,
    230,
    77,
    128
   ]
  },
  "points": {
   "kloBirne": [
    136.4,
    120.1
   ],
   "kloOben": [
    136.8,
    146.3
   ],
   "kloUnten": [
    118.7,
    340.0
   ],
   "lampe": [
    545.0,
    47.0
   ],
   "lampeFuss": [
    545.0,
    342.0
   ],
   "baum": [
    700.0,
    356.0
   ]
  },
  "variants": {
   "zelle_weg": {
    "src": "img/altbau/fgarten_zelle_weg.jpg",
    "x": 518.0,
    "y": 6.0,
    "w": 59.0,
    "h": 82.0
   }
  },
  "sprites": {
   "baum": {
    "src": "img/altbau/fgarten_baum.png",
    "x": 545.0,
    "y": 31.0,
    "w": 323.0,
    "h": 331.0,
    "pivot": [
     700.0,
     356.0
    ]
   }
  }
 },
 "vorraum": {
  "anchors": {
   "Garten": [
    -13,
    137,
    113,
    198
   ],
   "Plakat": [
    148,
    92,
    134,
    146
   ],
   "Banner0": [
    294,
    40,
    48,
    192
   ],
   "Banner1": [
    640,
    40,
    44,
    192
   ],
   "Verbot": [
    712,
    96,
    141,
    80
   ],
   "Tuer": [
    390,
    64,
    190,
    271
   ],
   "Aufzug": [
    876,
    174,
    85,
    160
   ]
  },
  "points": {
   "regen0": [
    2.1,
    170.8
   ],
   "regen1": [
    90.0,
    333.8
   ]
  },
  "variants": {},
  "sprites": {}
 },
 "thron": {
  "anchors": {
   "Vorraum": [
    -13,
    137,
    113,
    198
   ],
   "Thron": [
    573,
    81,
    179,
    244
   ],
   "Laeufer": [
    380,
    350,
    304,
    90
   ]
  },
  "points": {
   "leuchter": [
    300.0,
    0.0
   ]
  },
  "variants": {},
  "sprites": {
   "leuchter": {
    "src": "img/altbau/thron_leuchter.png",
    "x": 245.0,
    "y": 0.0,
    "w": 112.0,
    "h": 114.0,
    "pivot": [
     300.0,
     0.0
    ]
   }
  }
 }
};
