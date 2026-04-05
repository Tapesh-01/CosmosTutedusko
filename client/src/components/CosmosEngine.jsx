import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

// Predefined avatar colors
const AVATAR_COLORS = [0x6c3fff, 0xff3f8e, 0x10b981, 0xf59e0b, 0x3b82f6, 0xef4444, 0x8b5cf6, 0xe67e22];
const getColorForId = (id) => AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length];

const PROXIMITY_RADIUS = 90;
const BOUNDARY_HALF = 55; // half-size of square boundary

const CosmosEngine = ({ onUpdatePosition, userName, remoteUsers, zoom = 1.0, proximityUsers = [], isHandRaised = false, targetPosition = null }) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const avatarsRef = useRef({});
  const positionRef = useRef({ x: 500, y: 400 });
  const keysRef = useRef({});
  const zoomRef = useRef(zoom);
  const boundaryRef = useRef(null);
  const proximityUsersRef = useRef(proximityUsers);

  // Keep zoom ref in sync
  useEffect(() => {
    zoomRef.current = zoom;
    if (appRef.current) {
      const app = appRef.current;
      app.stage.scale.set(zoom);
      const me = avatarsRef.current['me'];
      if (me) {
        const hw = containerRef.current.clientWidth / 2;
        const hh = containerRef.current.clientHeight / 2;
        app.stage.x = hw - me.x * zoom;
        app.stage.y = hh - me.y * zoom;
      }
    }
  }, [zoom]);

  // Sync proximity state into ref so the ticker can read it
  useEffect(() => {
    proximityUsersRef.current = proximityUsers;
    // Update boundary ring color
    const boundary = boundaryRef.current;
    if (!boundary) return;
    const isNear = proximityUsers.length > 0;
    boundary.clear();
    boundary
      .roundRect(-BOUNDARY_HALF, -BOUNDARY_HALF, BOUNDARY_HALF * 2, BOUNDARY_HALF * 2, 10)
      .fill({ color: isNear ? 0x10b981 : 0x6c3fff, alpha: isNear ? 0.09 : 0.05 })
      .stroke({ color: isNear ? 0x10b981 : 0x6c3fff, width: isNear ? 2 : 1.5, alpha: isNear ? 0.5 : 0.22 });
  }, [proximityUsers]);

  // ─── AVATAR FACTORY ─────────────────────────────────────────
  const buildAvatar = (name, color) => {
    const g = new PIXI.Container();

    // Shadow
    const shadow = new PIXI.Graphics()
      .ellipse(0, 38, 20, 8)
      .fill({ color: 0x000000, alpha: 0.12 });

    // Legs
    const legs = new PIXI.Graphics()
      .roundRect(-11, 24, 9, 18, 5).fill(0x374151)
      .roundRect(2, 24, 9, 18, 5).fill(0x374151);

    // Shoes
    const shoes = new PIXI.Graphics()
      .roundRect(-13, 38, 12, 6, 3).fill(0xf5e6c8) // light shoes
      .roundRect(1, 38, 12, 6, 3).fill(0xf5e6c8);

    // Body (colorful shirt)
    const body = new PIXI.Graphics()
      .roundRect(-15, -2, 30, 28, 8)
      .fill(color);

    // Collar
    const collar = new PIXI.Graphics()
      .roundRect(-6, -3, 12, 8, 4)
      .fill(0xffffff);

    // Head
    const head = new PIXI.Graphics()
      .circle(0, -20, 18)
      .fill(0xffcc99);

    // Hair (dark)
    const hair = new PIXI.Graphics()
      .ellipse(0, -33, 16, 9)
      .fill(0x1a1a2e);

    // Hair side pieces
    const hairSide = new PIXI.Graphics()
      .roundRect(-17, -32, 5, 12, 4).fill(0x1a1a2e)
      .roundRect(12, -32, 5, 12, 4).fill(0x1a1a2e);

    // Eyes (bigger, more expressive)
    const eyes = new PIXI.Graphics()
      .circle(-6, -21, 4).fill(0xffffff)
      .circle(6, -21, 4).fill(0xffffff)
      .circle(-6, -21, 2.5).fill(0x2d2d44)
      .circle(6, -21, 2.5).fill(0x2d2d44)
      .circle(-5, -22, 1).fill(0xffffff) // eye shine
      .circle(7, -22, 1).fill(0xffffff);

    // Eyebrows
    const eyebrows = new PIXI.Graphics();
    eyebrows.moveTo(-9, -27); eyebrows.lineTo(-3, -26);
    eyebrows.moveTo(3, -26); eyebrows.lineTo(9, -27);
    eyebrows.stroke({ color: 0x1a1a2e, width: 2, cap: 'round' });

    // Smile
    const mouth = new PIXI.Graphics();
    mouth.moveTo(-5, -13);
    mouth.quadraticCurveTo(0, -9, 5, -13);
    mouth.stroke({ color: 0xd4706e, width: 2, cap: 'round' });

    // Name tag with rounded bg
    const displayName = name.length > 10 ? name.slice(0, 9) + '…' : name;
    const tagText = new PIXI.Text({
      text: displayName,
      style: {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 11,
        fill: 0xffffff,
        fontWeight: '700',
      },
    });
    tagText.anchor.set(0.5, 0);
    tagText.x = 0;
    tagText.y = 52;

    const tagW = tagText.width + 20;
    const tagBg = new PIXI.Graphics()
      .roundRect(-tagW / 2, 48, tagW, 20, 6)
      .fill({ color: 0x1a1a2e, alpha: 0.75 });

    // Online dot beside name
    const onlineDot = new PIXI.Graphics()
      .circle(tagW / 2 - 6, 58, 4)
      .fill(0x10b981);

    g.addChild(shadow, shoes, legs, body, collar, head, hair, hairSide, eyes, eyebrows, mouth, tagBg, tagText, onlineDot);
    // Scale avatar down
    g.scale.set(0.65);
    // Hand indicator ✋
    const hand = new PIXI.Text({
      text: '✋',
      style: { fontSize: 18 }
    });
    hand.x = 15; hand.y = -45;
    hand.visible = false;
    g.addChild(hand);

    g.hand = hand; // reference for later
    return g;
  };

  // ─── WORLD BUILDER ──────────────────────────────────────────
  const buildWorld = (app) => {
    const worldW = 2200;
    const worldH = 1400;

    // 1. Outer grass / forest border
    const outerGrass = new PIXI.Graphics()
      .rect(-400, -400, worldW + 800, worldH + 800)
      .fill(0x3d6b4a);
    app.stage.addChild(outerGrass);

    // Dense trees along outer edge
    const addTree = (x, y, scale = 1) => {
      const t = new PIXI.Container();
      const trunk = new PIXI.Graphics().roundRect(-5, 0, 10, 18, 3).fill(0x5a3e28);
      const c1 = new PIXI.Graphics().circle(0, -6, 18 * scale).fill({ color: 0x2d6a4f, alpha: 0.95 });
      const c2 = new PIXI.Graphics().circle(-7, -14, 13 * scale).fill({ color: 0x52b788, alpha: 0.85 });
      const c3 = new PIXI.Graphics().circle(8, -12, 12 * scale).fill({ color: 0x40916c, alpha: 0.9 });
      t.addChild(trunk, c1, c2, c3);
      t.x = x; t.y = y;
      app.stage.addChild(t);
    };

    for (let x = -360; x < worldW + 400; x += 44) {
      addTree(x, -20, 0.85);
      addTree(x + 22, worldH + 10, 0.85);
    }
    for (let y = 0; y < worldH; y += 44) {
      addTree(-20, y, 0.85);
      addTree(worldW + 20, y, 0.85);
    }

    // 2. Main wooden brick floor (light sandy/brick look like Cosmos)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 64; floorCanvas.height = 64;
    const fc = floorCanvas.getContext('2d');

    // Base tile color (light sandy brick)
    fc.fillStyle = '#e8d4a8';
    fc.fillRect(0, 0, 64, 64);
    // Horizontal mortar lines
    fc.strokeStyle = '#c8b48a';
    fc.lineWidth = 1.5;
    for (let y = 0; y <= 64; y += 32) {
      fc.beginPath(); fc.moveTo(0, y); fc.lineTo(64, y); fc.stroke();
    }
    // Vertical mortar (staggered per row)
    fc.strokeStyle = '#c8b48a';
    fc.lineWidth = 1.5;
    // Row 1: one divider at 32
    fc.beginPath(); fc.moveTo(32, 0); fc.lineTo(32, 32); fc.stroke();
    // Row 2: divider at 0 and 64 (staggered)
    fc.beginPath(); fc.moveTo(0, 32); fc.lineTo(0, 64); fc.stroke();
    fc.beginPath(); fc.moveTo(64, 32); fc.lineTo(64, 64); fc.stroke();
    // Subtle brick tint variation
    fc.fillStyle = 'rgba(0,0,0,0.02)';
    fc.fillRect(0, 0, 32, 32);
    fc.fillStyle = 'rgba(255,255,255,0.03)';
    fc.fillRect(32, 32, 32, 32);

    const floorTex = PIXI.Texture.from(floorCanvas);
    const floor = new PIXI.TilingSprite({ texture: floorTex, width: worldW, height: worldH });
    floor.x = 0; floor.y = 0;
    app.stage.addChild(floor);

    // ── Visual World Border (Ground limit) ──
    const floorBorder = new PIXI.Graphics()
      .rect(0, 0, worldW, worldH)
      .stroke({ color: 0xc8b48a, width: 4, alpha: 0.8 });
    app.stage.addChild(floorBorder);

    // ─── HELPER FUNCTIONS ────────────────────────────
    const addZoneBox = (x, y, w, h, color, alpha = 0.08) => {
      const box = new PIXI.Graphics()
        .rect(x, y, w, h)
        .fill({ color, alpha })
        .stroke({ color, width: 2, alpha: 0.35 });
      app.stage.addChild(box);
    };

    const addZoneLabel = (text, x, y, fontSize = 13, color = 0x2d2d44) => {
      const txt = new PIXI.Text({
        text,
        style: {
          fontFamily: 'Inter, Arial',
          fontSize,
          fill: color,
          fontWeight: '800',
          letterSpacing: 0.5,
        },
      });
      txt.anchor.set(0.5, 0.5);
      txt.x = x; txt.y = y;
      app.stage.addChild(txt);
    };

    const addChair = (x, y, rotation = 0, color = 0xa0877a) => {
      const seat = new PIXI.Graphics()
        .roundRect(-9, -9, 18, 18, 3).fill(color);
      const back = new PIXI.Graphics()
        .roundRect(-9, -14, 18, 6, 2).fill(0x7a5c52);
      const c = new PIXI.Container();
      c.addChild(seat, back);
      c.x = x; c.y = y; c.rotation = rotation;
      app.stage.addChild(c);
    };

    const addDesk = (x, y, w = 70, h = 35) => {
      const desk = new PIXI.Graphics()
        .rect(x, y, w, h)
        .fill(0xd4a96a)
        .stroke({ color: 0xb8895a, width: 1.5 });
      app.stage.addChild(desk);
      // Laptop on desk
      const laptop = new PIXI.Graphics()
        .roundRect(x + w / 2 - 14, y + 6, 28, 18, 2).fill(0x374151);
      const screen = new PIXI.Graphics()
        .rect(x + w / 2 - 12, y + 8, 24, 14).fill(0x60a5fa);
      app.stage.addChild(laptop, screen);
    };

    const addSofa = (x, y, w = 90, h = 35, color = 0x4c6e8a) => {
      const sofa = new PIXI.Graphics()
        .roundRect(x, y, w, h, 8).fill(color);
      const back = new PIXI.Graphics()
        .rect(x, y, w, 10).fill(0x3a5570);
      const lArm = new PIXI.Graphics()
        .roundRect(x, y, 10, h, 5).fill(0x3a5570);
      const rArm = new PIXI.Graphics()
        .roundRect(x + w - 10, y, 10, h, 5).fill(0x3a5570);
      // Cushions
      const cush1 = new PIXI.Graphics()
        .roundRect(x + 14, y + 12, 28, 18, 4).fill(0x6b8fa8);
      const cush2 = new PIXI.Graphics()
        .roundRect(x + 48, y + 12, 28, 18, 4).fill(0x6b8fa8);
      app.stage.addChild(sofa, back, lArm, rArm, cush1, cush2);
    };

    const addRoundTable = (x, y, r = 20) => {
      const t = new PIXI.Graphics()
        .circle(x, y, r).fill(0xdeb887)
        .circle(x, y, r - 3).fill(0xc8a855).stroke({ color: 0xb8985a, width: 1.5 });
      app.stage.addChild(t);
    };

    const addPlant = (x, y) => {
      const pot = new PIXI.Graphics()
        .roundRect(x - 8, y, 16, 12, 3).fill(0xe07b54);
      const plant1 = new PIXI.Graphics()
        .circle(x, y - 8, 10).fill({ color: 0x2d9e5a, alpha: 0.9 });
      const plant2 = new PIXI.Graphics()
        .circle(x + 6, y - 4, 8).fill({ color: 0x52b788, alpha: 0.85 });
      app.stage.addChild(pot, plant1, plant2);
    };

    const addBigText = (text, x, y, fontSize = 36, color = 0x000000, alpha = 0.12) => {
      const txt = new PIXI.Text({
        text,
        style: { fontFamily: 'Inter, Arial', fontSize, fill: color, fontWeight: '900', alpha },
      });
      txt.anchor.set(0.5, 0.5);
      txt.x = x; txt.y = y;
      app.stage.addChild(txt);
    };

    // ─── ZONE LAYOUT ─────────────────────────────────

    // MERN STACK lounge (top-left)
    addZoneBox(40, 40, 330, 280, 0x6c3fff);
    addZoneLabel('MERN STACK', 205, 295, 13, 0x4c2dcc);
    addSofa(60, 60, 100, 36, 0x6c3fff);
    addSofa(200, 60, 100, 36, 0x6c3fff);
    addRoundTable(160, 140);
    addChair(100, 145, 0, 0xc0a090);
    addChair(160, 170, 0, 0xc0a090);
    addChair(220, 145, Math.PI, 0xc0a090);
    addChair(160, 115, Math.PI, 0xc0a090);
    addPlant(45, 45);
    addPlant(340, 45);

    // UI/UX zone (top middle)
    addZoneBox(430, 40, 250, 180, 0x10b981);
    addZoneLabel('UI/UX', 555, 200, 13, 0x0a7a54);
    for (let col = 0; col < 3; col++) {
      addDesk(445 + col * 82, 60);
      addChair(480 + col * 82, 55, Math.PI, 0x90b090);
      addChair(480 + col * 82, 105, 0, 0x90b090);
    }
    addPlant(435, 42);

    // ETHICAL HACKING (top right area)
    addZoneBox(730, 40, 300, 200, 0xef4444);
    addZoneLabel('ETHICAL HACKING', 880, 220, 12, 0xcc2222);
    for (let col = 0; col < 3; col++) {
      addDesk(745 + col * 88, 60);
      addChair(780 + col * 88, 55, Math.PI, 0xaaaaaa);
      addChair(780 + col * 88, 105, 0, 0xaaaaaa);
    }

    // Dev Club - large theater (right side)
    const devClubColor = 0x8b5cf6;
    addZoneBox(1100, 40, 1060, 760, devClubColor, 0.06);
    addZoneLabel('Dev Club', 1630, 790, 18, devClubColor);
    // Rows of chairs (theater seating)
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 19; col++) {
        addChair(1130 + col * 52, 60 + row * 48, 0,
          row % 2 === 0 ? 0x6c3fff : 0x8b5cf6);
      }
    }
    // Stage at bottom of Dev Club
    const stage = new PIXI.Graphics()
      .roundRect(1200, 720, 800, 60, 6).fill(0x5a3e28);
    app.stage.addChild(stage);
    addZoneLabel('🎙 Stage', 1600, 750, 14, 0xffffff);
    addPlant(1110, 50);
    addPlant(2140, 50);

    // DSA zone (left, mid)
    addZoneBox(40, 370, 200, 200, 0xf59e0b);
    addZoneLabel('DSA', 140, 550, 15, 0xb87000);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        addDesk(55 + c * 90, 385 + r * 58);
        addChair(90 + c * 90, 380 + r * 58, Math.PI, 0xd4a060);
      }
    }

    // Flutter zone
    addZoneBox(260, 370, 180, 200, 0x3b82f6);
    addZoneLabel('Flutter', 350, 550, 14, 0x1a4a99);
    for (let r = 0; r < 3; r++) {
      addDesk(275, 385 + r * 58);
      addChair(310, 380 + r * 58, Math.PI, 0x8abfea);
      addChair(310, 428 + r * 58, 0, 0x8abfea);
    }

    // Room grouping: Double Tap area (middle)
    addZoneBox(460, 320, 200, 160, 0xa0522d, 0.07);
    addZoneLabel('Double Tap', 560, 460, 12, 0x6b3518);
    addSofa(475, 345, 80, 30, 0x8b6356);
    addRoundTable(555, 385);
    addChair(530, 400, 0);
    addChair(580, 400, 0);

    // Financial Modelling (bottom area)
    addZoneBox(40, 860, 240, 200, 0x10b981, 0.08);
    addZoneLabel('Financial Modelling', 160, 1040, 11, 0x0a7a54);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        addDesk(55 + c * 110, 875 + r * 55);
        addChair(90 + c * 110, 870 + r * 55, Math.PI, 0x80c08a);
      }
    }

    // Data Analytics
    addZoneBox(320, 860, 220, 200, 0x6c3fff, 0.08);
    addZoneLabel('Data Analytics', 430, 1040, 11, 0x4c2dcc);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        addDesk(335 + c * 100, 875 + r * 55);
        addChair(370 + c * 100, 870 + r * 55, Math.PI, 0xa08ec0);
      }
    }

    // Python
    addZoneBox(580, 860, 200, 200, 0x3b82f6, 0.08);
    addZoneLabel('Python', 680, 1040, 12, 0x1a4a99);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        addChair(595 + c * 90, 875 + r * 55, 0, 0x8090c0);
      }
    }

    // Graphics & AI Club (bottom right area)
    addZoneBox(820, 860, 260, 200, 0xf59e0b, 0.07);
    addZoneLabel('Graphics AI Club', 950, 1040, 11, 0xb87000);
    addSofa(835, 885, 120, 30, 0xd4a060);
    addRoundTable(950, 960);
    addChair(920, 972, 0); addChair(980, 972, 0);
    addChair(950, 945, Math.PI); addChair(950, 995, 0);

    // SpeakUP (bottom right)
    addZoneBox(1120, 860, 200, 200, 0xef4444, 0.07);
    addZoneLabel('SpeakUP', 1220, 1040, 13, 0xcc2222);
    addSofa(1135, 885, 100, 30, 0xe87070);
    addChair(1175, 940, 0, 0xffaaaa);
    addChair(1220, 940, 0, 0xffaaaa);
    addChair(1265, 940, 0, 0xffaaaa);

    // Gaming Area
    addZoneBox(1360, 860, 200, 200, 0x8b5cf6, 0.07);
    addZoneLabel('Gaming Area', 1460, 1040, 12, 0x5a2dcc);
    addSofa(1375, 880, 90, 30, 0x7c4fcc);
    addSofa(1375, 940, 90, 30, 0x7c4fcc);

    // Decorative floor hints
    addBigText('To Fly 🚀:', 730, 440, 40, 0x1a1a2e, 0.1);
    addBigText('Double Tap', 730, 500, 40, 0x1a1a2e, 0.1);
    addBigText('Zoom In/Out', 200, 720, 40, 0x1a1a2e, 0.1);

    // Scattered plants for decoration
    addPlant(455, 320); addPlant(1090, 850);
    addPlant(40, 600); addPlant(1360, 855);
  };

  // ─── PIXI INIT ──────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;

    const init = async () => {
      if (!containerRef.current) return;

      const app = new PIXI.Application();
      await app.init({
        resizeTo: containerRef.current,
        background: 0xe8d4a8,
        antialias: true,
      });
      if (destroyed) { app.destroy(true); return; }

      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      buildWorld(app);

      // ── Proximity boundary (square) around local avatar ──
      const boundary = new PIXI.Graphics();
      boundary
        .roundRect(-BOUNDARY_HALF, -BOUNDARY_HALF, BOUNDARY_HALF * 2, BOUNDARY_HALF * 2, 10)
        .fill({ color: 0x6c3fff, alpha: 0.05 })
        .stroke({ color: 0x6c3fff, width: 1.5, alpha: 0.22 });
      boundary.x = 500; boundary.y = 400;
      app.stage.addChild(boundary);
      boundaryRef.current = boundary;

      // My Avatar (pink/purple)
      const myAvatar = buildAvatar(userName, 0xec4899);
      myAvatar.x = 500; myAvatar.y = 400;
      app.stage.addChild(myAvatar);
      avatarsRef.current['me'] = myAvatar;

      // Camera: center on avatar initially
      const hw = containerRef.current.clientWidth / 2;
      const hh = containerRef.current.clientHeight / 2;
      app.stage.scale.set(zoomRef.current);
      app.stage.x = hw - 500 * zoomRef.current;
      app.stage.y = hh - 400 * zoomRef.current;

      // Movement Ticker
      app.ticker.add((ticker) => {
        const z = zoomRef.current;
        app.stage.scale.set(z);

        const speed = 3.5 * ticker.deltaTime;
        const k = keysRef.current;
        let dx = 0, dy = 0;
        if (k['w'] || k['ArrowUp'])    dy -= speed;
        if (k['s'] || k['ArrowDown'])  dy += speed;
        if (k['a'] || k['ArrowLeft'])  dx -= speed;
        if (k['d'] || k['ArrowRight']) dx += speed;

        if (dx !== 0 || dy !== 0) {
          // ── Clamp to world boundaries ──
          const WORLD_W = 2200, WORLD_H = 1400, PAD = 30;
          positionRef.current.x = Math.max(PAD, Math.min(WORLD_W - PAD, positionRef.current.x + dx));
          positionRef.current.y = Math.max(PAD, Math.min(WORLD_H - PAD, positionRef.current.y + dy));
          myAvatar.x = positionRef.current.x;
          myAvatar.y = positionRef.current.y;

          // Boundary ring follows avatar
          if (boundaryRef.current) {
            boundaryRef.current.x = positionRef.current.x;
            boundaryRef.current.y = positionRef.current.y;
          }

          // Camera follows avatar
          const targetX = containerRef.current.clientWidth / 2 - myAvatar.x * z;
          const targetY = containerRef.current.clientHeight / 2 - myAvatar.y * z;
          app.stage.x += (targetX - app.stage.x) * 0.1;
          app.stage.y += (targetY - app.stage.y) * 0.1;

          onUpdatePosition(positionRef.current.x, positionRef.current.y);
        }
      });
    };

    init();

    const onDown = (e) => {
      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (isTyping) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current[e.key] = true;
    };
    const onUp = (e) => { delete keysRef.current[e.key]; };
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);

    return () => {
      destroyed = true;
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('keyup', onUp);
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
      avatarsRef.current = {};
    };
  }, []);

  // ─── SYNC REMOTE USERS ──────────────────────────────────────
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    Object.keys(avatarsRef.current).forEach((id) => {
      if (id !== 'me' && !remoteUsers[id]) {
        const a = avatarsRef.current[id];
        app.stage.removeChild(a); a.destroy({ children: true });
        delete avatarsRef.current[id];
      }
    });

    Object.keys(remoteUsers).forEach((id) => {
      const u = remoteUsers[id];
      if (!avatarsRef.current[id]) {
        const colorHex = u.color ? parseInt(u.color.replace('#', ''), 16) : getColorForId(id);
        const avatar = buildAvatar(u.name, colorHex);
        avatar.x = u.x; avatar.y = u.y;
        avatar.hand.visible = !!u.isHandRaised;
        app.stage.addChild(avatar);
        avatarsRef.current[id] = avatar;
      } else {
        avatarsRef.current[id].x = u.x;
        avatarsRef.current[id].y = u.y;
        avatarsRef.current[id].hand.visible = !!u.isHandRaised;
      }
    });
  }, [remoteUsers]);

  // ─── SYNC LOCAL HAND ────────────────────────────────────────
  useEffect(() => {
    const me = avatarsRef.current['me'];
    if (me) me.hand.visible = isHandRaised;
  }, [isHandRaised]);

  // ─── SYNC LOCAL POSITION (Reset) ──────────────────────────
  useEffect(() => {
    if (targetPosition && avatarsRef.current['me']) {
      positionRef.current = { ...targetPosition };
      avatarsRef.current['me'].x = targetPosition.x;
      avatarsRef.current['me'].y = targetPosition.y;
    }
  }, [targetPosition]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default CosmosEngine;
