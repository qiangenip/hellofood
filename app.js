var STORAGE_KEY = "food-wheel-v1";
var MAX_HISTORY = 10;
var MAX_SECTORS = 6;

var defaultRestaurants = [
  { id: "1", name: "兰州拉面", price: 18, walkMins: 6, flavor: "soup", blacklisted: false },
  { id: "2", name: "麻辣烫", price: 23, walkMins: 12, flavor: "spicy", blacklisted: false },
  { id: "3", name: "黄焖鸡米饭", price: 20, walkMins: 8, flavor: "spicy", blacklisted: false },
  { id: "4", name: "轻食沙拉", price: 29, walkMins: 10, flavor: "light", blacklisted: false },
  { id: "5", name: "番茄牛腩面", price: 26, walkMins: 16, flavor: "soup", blacklisted: false },
  { id: "6", name: "煲仔饭", price: 22, walkMins: 9, flavor: "light", blacklisted: false },
  { id: "7", name: "小炒盖饭", price: 17, walkMins: 7, flavor: "spicy", blacklisted: false },
  { id: "8", name: "日式豚骨拉面", price: 35, walkMins: 18, flavor: "soup", blacklisted: false },
];

var flavorIcons = {
  spicy: ["🌶️", "🔥", "🥵", "🍗", "🌮", "🥘"],
  light: ["🥬", "🥗", "🥒", "🥑", "🥦", "🍎"],
  soup:  ["🍜", "🍲", "🥘", "🍝", "🫕", "🥟"],
};

var sectorColors = [
  "#FDF8F5", "#FAD4C8", "#FDF0D0", "#E8E4DF", "#F2D5D8", "#DCE4D4",
];

var state = {
  restaurants: [],
  history: [],
  filtered: [],
  displayItems: [],
  selected: null,
  rotation: 0,
  isSpinning: false,
};

var budgetFilter = document.getElementById("budgetFilter");
var distanceFilter = document.getElementById("distanceFilter");
var flavorFilter = document.getElementById("flavorFilter");
var candidateInfo = document.getElementById("candidateInfo");
var spinBtn = document.getElementById("spinBtn");
var resultCard = document.getElementById("resultCard");
var historyList = document.getElementById("historyList");
var canvas = document.getElementById("wheelCanvas");
var ctx = canvas.getContext("2d");
var manageDialog = document.getElementById("manageDialog");
var openManageBtn = document.getElementById("openManageBtn");
var restaurantList = document.getElementById("restaurantList");
var addRestaurantBtn = document.getElementById("addRestaurantBtn");

var newName = document.getElementById("newName");
var newPrice = document.getElementById("newPrice");
var newWalk = document.getElementById("newWalk");
var newFlavor = document.getElementById("newFlavor");

var typewriterTimer = null;
var wheelWrap = document.querySelector(".wheel-wrap");

// ── Util ──

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i -= 1) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ── State ──

function loadState() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.restaurants = defaultRestaurants.slice();
    state.history = [];
    persist();
    return;
  }
  try {
    var parsed = JSON.parse(raw);
    state.restaurants = parsed.restaurants || defaultRestaurants.slice();
    state.history = (parsed.history || []).slice(0, MAX_HISTORY);
  } catch (e) {
    state.restaurants = defaultRestaurants.slice();
    state.history = [];
  }
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      restaurants: state.restaurants,
      history: state.history.slice(0, MAX_HISTORY),
    })
  );
}

// ── Filters ──

function matchesBudget(item, budget) {
  if (budget === "all") return true;
  if (budget === "low") return item.price < 15;
  if (budget === "mid") return item.price >= 15 && item.price <= 30;
  return item.price > 30;
}

function matchesDistance(item, distance) {
  if (distance === "all") return true;
  if (distance === "near") return item.walkMins <= 10;
  if (distance === "mid") return item.walkMins > 10 && item.walkMins <= 20;
  return item.walkMins > 20;
}

function applyFilters() {
  var budget = budgetFilter.value;
  var distance = distanceFilter.value;
  var flavor = flavorFilter.value;

  state.filtered = state.restaurants.filter(function (item) {
    if (item.blacklisted) return false;
    if (!matchesBudget(item, budget)) return false;
    if (!matchesDistance(item, distance)) return false;
    if (flavor !== "all" && item.flavor !== flavor) return false;
    return true;
  });

  candidateInfo.textContent = "当前可转候选：" + state.filtered.length + " 家";
  spinBtn.disabled = state.filtered.length < 2;
  resetSpinBtn();
  refreshDisplayItems();
  drawWheel();
}

// ── Display Items ──

function refreshDisplayItems() {
  if (state.filtered.length === 0) {
    state.displayItems = [];
    return;
  }
  var n = Math.min(MAX_SECTORS, state.filtered.length);
  var pool = shuffle(state.filtered);
  state.displayItems = pool.slice(0, n);
}

// ── Helpers ──

function flavorText(flavor) {
  if (flavor === "spicy") return "辣口";
  if (flavor === "light") return "清淡";
  return "汤类";
}

function flavorEmoji(flavor) {
  if (flavor === "spicy") return "🌶️";
  if (flavor === "light") return "🥬";
  return "🍲";
}

function wheelIcon(item, index) {
  var icons = flavorIcons[item.flavor] || ["❓"];
  return icons[index % icons.length];
}

function resetSpinBtn() {
  spinBtn.textContent = "开始转盘";
  spinBtn.className = "btn primary";
  state.isSpinning = false;
}

// ── Wheel Drawing ──

function drawWheel() {
  var items = state.displayItems;
  var radius = 164;
  var center = 210;
  ctx.clearRect(0, 0, 420, 420);

  // Outer shadow ring
  ctx.beginPath();
  ctx.arc(center, center, radius + 14, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fill();

  // Dot ring
  var dotCount = 60;
  var dotR = radius + 22;
  for (var d = 0; d < dotCount; d += 1) {
    var da = (Math.PI * 2 / dotCount) * d;
    var dx = center + Math.cos(da) * dotR;
    var dy = center + Math.sin(da) * dotR;
    ctx.beginPath();
    ctx.arc(dx, dy, d % 5 === 0 ? 3.5 : 2, 0, Math.PI * 2);
    ctx.fillStyle = d % 5 === 0 ? "#E07050" : "#1C1C1E";
    ctx.fill();
  }

  // Inner tick ring
  var tickCount = 24;
  for (var t = 0; t < tickCount; t += 1) {
    var ta = (Math.PI * 2 / tickCount) * t + state.rotation;
    var innerR = radius - 8;
    var outerR = radius + 2;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(ta) * innerR, center + Math.sin(ta) * innerR);
    ctx.lineTo(center + Math.cos(ta) * outerR, center + Math.sin(ta) * outerR);
    ctx.strokeStyle = "#1C1C1E";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (items.length === 0) {
    ctx.fillStyle = "#1C1C1E";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("无可用店铺", center, center);
    return;
  }

  var arc = (Math.PI * 2) / items.length;

  for (var i = 0; i < items.length; i += 1) {
    var start = state.rotation + i * arc;
    var end = start + arc;

    // Sector fill
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();

    // Per-sector gradient
    var midAngle = start + arc / 2;
    var gx = center + Math.cos(midAngle) * radius * 0.5;
    var gy = center + Math.sin(midAngle) * radius * 0.5;
    var sGrad = ctx.createLinearGradient(center, center, gx + Math.cos(midAngle) * radius, gy + Math.sin(midAngle) * radius);
    sGrad.addColorStop(0, "rgba(255,255,255,0.3)");
    sGrad.addColorStop(0.6, sectorColors[i % sectorColors.length]);
    sGrad.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = sGrad;
    ctx.fill();

    // Sector border
    ctx.strokeStyle = "#1C1C1E";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Emoji
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(midAngle);
    ctx.textAlign = "right";
    ctx.font = "24px sans-serif";
    ctx.fillText(wheelIcon(items[i], i), radius - 22, 8);
    ctx.restore();
  }

  // Global radial overlay for depth
  var grad = ctx.createRadialGradient(center, center, radius * 0.2, center, center, radius);
  grad.addColorStop(0, "rgba(255,255,255,0.2)");
  grad.addColorStop(0.65, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Glow slot
  var slotHalf = 0.22;
  var slotAngle = -Math.PI / 2;
  var slotGrad = ctx.createRadialGradient(center, center - radius + 14, 2, center, center - radius + 14, 36);
  slotGrad.addColorStop(0, "rgba(255,255,255,0.95)");
  slotGrad.addColorStop(0.4, "rgba(245,176,66,0.35)");
  slotGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(center, center, radius, slotAngle - slotHalf, slotAngle + slotHalf);
  ctx.lineTo(center, center);
  ctx.closePath();
  ctx.fillStyle = slotGrad;
  ctx.fill();

  // Center hub
  ctx.beginPath();
  ctx.arc(center, center, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#1C1C1E";
  ctx.fill();
  ctx.strokeStyle = "#F5B042";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Center diamond
  ctx.beginPath();
  ctx.moveTo(center, center - 12);
  ctx.lineTo(center + 8, center);
  ctx.lineTo(center, center + 12);
  ctx.lineTo(center - 8, center);
  ctx.closePath();
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  // Pointer
  ctx.beginPath();
  ctx.fillStyle = "#E07050";
  ctx.moveTo(center, center - radius - 14);
  ctx.lineTo(center - 14, center - radius + 32);
  ctx.lineTo(center + 14, center - radius + 32);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#1C1C1E";
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ── Typewriter ──

function typewriterWrite(el, text, onDone) {
  var i = 0;
  el.textContent = "";
  function tick() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i += 1;
      typewriterTimer = setTimeout(tick, 80);
    } else {
      if (onDone) onDone();
    }
  }
  tick();
}

function updateResult(item) {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer);
    typewriterTimer = null;
  }

  if (!item) {
    resultCard.className = "result-card empty";
    resultCard.innerHTML = '<p>点击"开始转盘"，看看今天命运给你安排了什么。</p>';
    return;
  }

  resultCard.className = "result-card";
  resultCard.innerHTML =
    '<div class="result-main">' +
      '<h3 id="typewriterName"></h3>' +
      '<span class="chip">' + flavorEmoji(item.flavor) + ' ' + flavorText(item.flavor) + '</span>' +
    '</div>' +
    '<p>人均：￥' + item.price + ' · 步行约 ' + item.walkMins + ' 分钟</p>' +
    '<p class="muted">建议动作：立即出发，别再纠结。</p>';

  var nameEl = document.getElementById("typewriterName");
  if (nameEl) {
    typewriterWrite(nameEl, item.name);
  }
}

// ── Shake ──

function doShake() {
  wheelWrap.classList.add("shake");
  setTimeout(function () {
    wheelWrap.classList.remove("shake");
  }, 400);
}

// ── History ──

function deleteHistoryItem(index) {
  state.history.splice(index, 1);
  persist();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  if (state.history.length === 0) {
    historyList.innerHTML = "<li>今天还没记录</li>";
    return;
  }
  state.history
    .slice()
    .reverse()
    .forEach(function (h, revIndex) {
      var origIndex = state.history.length - 1 - revIndex;
      var li = document.createElement("li");
      var no = String(revIndex + 1).padStart(2, "0");
      li.innerHTML =
        '<span class="h-left">#' + no + '  ' + h.time + '  ' + flavorEmoji(h.flavor) + ' ' + h.name + '  ￥' + h.price + '</span>' +
        '<button class="h-del" data-index="' + origIndex + '" title="删除">×</button>';
      historyList.appendChild(li);
    });

  // Bind delete buttons
  var dels = historyList.querySelectorAll(".h-del");
  for (var d = 0; d < dels.length; d += 1) {
    dels[d].addEventListener("click", function (e) {
      e.stopPropagation();
      var idx = parseInt(this.getAttribute("data-index"), 10);
      deleteHistoryItem(idx);
    });
  }
}

// ── Spin ──

function spinWheel() {
  if (state.isSpinning) return;
  if (state.filtered.length < 2) return;
  state.isSpinning = true;

  // Pick fresh display items & winner
  refreshDisplayItems();
  var items = state.displayItems;
  var winnerSlot = Math.floor(Math.random() * items.length);
  var winner = items[winnerSlot];

  var arc = (Math.PI * 2) / items.length;
  var fullSpins = 6 * Math.PI * 2;
  var target = -winnerSlot * arc - arc / 2 - Math.PI / 2;
  var start = state.rotation;
  var end = start + fullSpins + (target - (start % (Math.PI * 2)));
  var duration = 1500;
  var startedAt = performance.now();

  canvas.classList.add("spinning");

  function animate(now) {
    var p = Math.min(1, (now - startedAt) / duration);
    var eased = 1 - Math.pow(1 - p, 3);
    state.rotation = start + (end - start) * eased;
    drawWheel();
    if (p < 1) {
      requestAnimationFrame(animate);
    } else {
      canvas.classList.remove("spinning");
      state.selected = winner;
      state.isSpinning = false;
      updateResult(winner);
      doShake();

      spinBtn.textContent = "不满意，再转一次";
      spinBtn.className = "btn secondary";

      var time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      state.history.push({ id: winner.id, name: winner.name, price: winner.price, walkMins: winner.walkMins, flavor: winner.flavor, time: time });
      if (state.history.length > MAX_HISTORY) {
        state.history = state.history.slice(-MAX_HISTORY);
      }
      persist();
      renderHistory();
    }
  }

  requestAnimationFrame(animate);
}

// ── Manage ──

function renderRestaurantManage() {
  restaurantList.innerHTML = "";
  state.restaurants.forEach(function (r) {
    var card = document.createElement("div");
    card.className = "restaurant-item";
    card.innerHTML =
      '<strong>' + r.name + '</strong>' +
      '<span class="meta">￥' + r.price + ' · ' + r.walkMins + '分钟 · ' + flavorText(r.flavor) + '</span>';

    var toggleBtn = document.createElement("button");
    toggleBtn.className = "btn ghost";
    toggleBtn.type = "button";
    toggleBtn.textContent = r.blacklisted ? "移除黑名单" : "加入黑名单";
    toggleBtn.addEventListener("click", function () {
      r.blacklisted = !r.blacklisted;
      persist();
      renderRestaurantManage();
      applyFilters();
    });
    card.appendChild(toggleBtn);
    restaurantList.appendChild(card);
  });
}

function addRestaurant() {
  var name = newName.value.trim();
  var price = Number(newPrice.value);
  var walk = Number(newWalk.value);
  var flavor = newFlavor.value;

  if (!name || !price || !walk) return;

  state.restaurants.push({
    id: String(Date.now()),
    name: name,
    price: price,
    walkMins: walk,
    flavor: flavor,
    blacklisted: false,
  });
  newName.value = "";
  newPrice.value = "";
  newWalk.value = "";
  persist();
  renderRestaurantManage();
  applyFilters();
}

// ── Events ──

function bindEvents() {
  [budgetFilter, distanceFilter, flavorFilter].forEach(function (el) {
    el.addEventListener("change", applyFilters);
  });
  spinBtn.addEventListener("click", function () {
    spinWheel();
  });

  openManageBtn.addEventListener("click", function () {
    renderRestaurantManage();
    manageDialog.showModal();
  });
  addRestaurantBtn.addEventListener("click", addRestaurant);
}

function setupBlinkCursor() {
  var h1 = document.querySelector(".header h1");
  if (h1) {
    h1.classList.add("blink-cursor");
  }
}

function init() {
  loadState();
  bindEvents();
  applyFilters();
  updateResult(null);
  renderHistory();
  setupBlinkCursor();
}

init();
