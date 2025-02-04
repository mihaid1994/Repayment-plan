/* script.js */

// Глобальный массив целей.
// Каждая цель – объект: { name, target, type, months (если regular), comment, createdDate }
let goals = [];

document.addEventListener("DOMContentLoaded", function () {
  // Устанавливаем дату старта – по умолчанию следующий месяц
  const startDateInput = document.getElementById("startDate");
  const now = new Date();
  let nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  startDateInput.value = nextMonth.toISOString().slice(0, 10);

  // Устанавливаем "Гибкий платеж" как тип цели по умолчанию
  const goalTypeSelect = document.getElementById("goalType");
  goalTypeSelect.value = "flexible"; // Установка flexible по умолчанию

  // Скрываем блок для "Регулярного платежа" по умолчанию
  const regularOptions = document.getElementById("regularOptions");
  regularOptions.style.display = "none";

  // При смене типа цели показываем/скрываем поле срока для regular-платежа
  goalTypeSelect.addEventListener("change", function () {
    regularOptions.style.display = this.value === "regular" ? "block" : "none";
  });

  updateGoalsUI();
  simulatePlan();
  tryFetchGoals();
  initDragAndDrop();
});

// Обновление списка целей (с поддержкой drag & drop)
function updateGoalsUI() {
  const goalsList = document.getElementById("goalsList");
  goalsList.innerHTML = "";
  if (goals.length === 0) {
    goalsList.innerHTML = "<p>Цели не заданы.</p>";
    return;
  }
  goals.forEach((goal, index) => {
    const goalDiv = document.createElement("div");
    goalDiv.className = "goal-item";
    goalDiv.setAttribute("draggable", "true");
    goalDiv.dataset.index = index;
    let desc = `<strong>${goal.name}</strong><br>Цель: ${formatRUB(
      goal.target
    )}`;
    if (goal.type === "regular") {
      desc += `<br>Срок: ${
        goal.months
      } мес. (<i class="ri-calculator-line"></i> Платёж: ${formatRUB(
        goal.target / goal.months
      )})`;
    } else {
      desc += `<br><i class="ri-time-line"></i> Гибкий накопление`;
    }
    if (goal.comment) {
      desc += `<br><i class="ri-chat-1-line"></i> ${goal.comment}`;
    }
    if (goal.createdDate) {
      desc += `<br><small>Создана: ${goal.createdDate}</small>`;
    }
    goalDiv.innerHTML = `
      <div class="goal-info">
        ${desc}
      </div>
      <div class="goal-actions">
        <button data-index="${index}" class="delete-goal">
          <i class="ri-delete-bin-line"></i>
        </button>
      </div>
    `;
    goalsList.appendChild(goalDiv);
  });
  // Обработчик удаления цели
  document.querySelectorAll(".delete-goal").forEach((btn) => {
    btn.addEventListener("click", function () {
      const idx = this.getAttribute("data-index");
      goals.splice(idx, 1);
      updateGoalsUI();
      simulatePlan();
    });
  });
  initDragAndDrop();
}

// Форматирование числа в рубли
function formatRUB(value) {
  return (
    Number(value).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " ₽"
  );
}

// Сохранение целей и параметров (включая дату старта) в JSON
function saveGoalsToJson() {
  const data = {
    monthlyContribution: document.getElementById("monthlyContribution").value,
    startDate: document.getElementById("startDate").value,
    goals: goals,
  };
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "goals.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Загрузка целей из JSON-файла
function loadGoalsFromFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.goals && Array.isArray(data.goals)) {
        goals = data.goals;
        if (data.monthlyContribution) {
          document.getElementById("monthlyContribution").value =
            data.monthlyContribution;
        }
        if (data.startDate) {
          document.getElementById("startDate").value = data.startDate;
        }
        updateGoalsUI();
        simulatePlan();
        alert("Цели успешно загружены!");
      } else {
        alert("Неверный формат JSON.");
      }
    } catch (err) {
      alert("Ошибка при чтении JSON: " + err);
    }
  };
  reader.readAsText(file);
}

// При загрузке страницы – попытка загрузить goals.json из корневой папки
function tryFetchGoals() {
  fetch("goals.json")
    .then((response) => {
      if (!response.ok) throw new Error("Нет файла goals.json");
      return response.json();
    })
    .then((data) => {
      if (data.goals && Array.isArray(data.goals)) {
        goals = data.goals;
        if (data.monthlyContribution) {
          document.getElementById("monthlyContribution").value =
            data.monthlyContribution;
        }
        if (data.startDate) {
          document.getElementById("startDate").value = data.startDate;
        }
        updateGoalsUI();
        simulatePlan();
      }
    })
    .catch((err) => {
      console.log("Файл goals.json не найден или не может быть загружен:", err);
    });
}

// Симуляция плана накоплений с учетом rollover (остаток месячного взноса)
// Каждый месяц доступно: monthlyContribution + carryover (с предыдущего месяца)
function simulatePlan() {
  const monthlyContribution =
    Number(document.getElementById("monthlyContribution").value) || 70000;
  const startDateValue = document.getElementById("startDate").value;
  let currentDate;
  if (startDateValue) {
    currentDate = new Date(startDateValue);
  } else {
    const now = new Date();
    currentDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  // Если у цели не задана createdDate, считаем, что она создана в день симуляции
  const simGoals = goals.map((g) => ({
    name: g.name,
    target: g.target,
    type: g.type,
    months: g.type === "regular" ? Number(g.months) : null,
    comment: g.comment,
    createdDate: g.createdDate
      ? new Date(g.createdDate)
      : new Date(currentDate),
    current: 0,
  }));

  let timelineRows = [];
  const maxMonths = 200;
  let monthCount = 0;
  let carryover = 0; // остаток, который переносится на следующий месяц

  while (monthCount < maxMonths && simGoals.some((g) => g.current < g.target)) {
    monthCount++;
    const monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];
    const monthLabel =
      monthNames[currentDate.getMonth()] + " " + currentDate.getFullYear();

    // Доступные средства в этом месяце = ежемесячный взнос + перенос со прошлого месяца
    let available = monthlyContribution + carryover;
    // Обнуляем carryover – он будет определён после распределения средств
    carryover = 0;
    let monthPayments = []; // платежи за этот месяц

    // Функция для проверки, доступна ли цель для начисления платежа.
    // Теперь цель считается доступной, если текущая дата симуляции >= даты создания цели.
    function isGoalEligible(goal) {
      let goalCreated = new Date(goal.createdDate);
      return currentDate >= goalCreated;
    }

    // 1. Обработка целей типа "Регулярный платеж"
    simGoals.forEach((goal) => {
      if (
        goal.type === "regular" &&
        goal.current < goal.target &&
        isGoalEligible(goal)
      ) {
        // Определяем дату завершения регулярного платежа: createdDate + срок (в месяцах)
        let dueDate = new Date(goal.createdDate);
        dueDate.setMonth(dueDate.getMonth() + goal.months);
        // Если текущая дата меньше dueDate – фиксированный платеж, иначе 0 (срок прошёл)
        let plannedPayment =
          currentDate < dueDate ? goal.target / goal.months : 0;
        let required = goal.target - goal.current;
        let payment = Math.min(plannedPayment, required, available);
        if (payment > 0) {
          goal.current += payment;
          available -= payment;
          monthPayments.push({
            goalName: goal.name,
            payment: payment,
            cumulative: goal.current,
            remainder: goal.target - goal.current,
          });
        }
      }
    });

    // 2. Обработка целей типа "Гибкий накопление"
    simGoals.forEach((goal) => {
      if (
        goal.type === "flexible" &&
        goal.current < goal.target &&
        isGoalEligible(goal)
      ) {
        let required = goal.target - goal.current;
        let payment = Math.min(required, available);
        if (payment > 0) {
          goal.current += payment;
          available -= payment;
          monthPayments.push({
            goalName: goal.name,
            payment: payment,
            cumulative: goal.current,
            remainder: goal.target - goal.current,
          });
        }
      }
    });

    // Остаток не израсходованных средств переносим на следующий месяц
    carryover = available;

    // Суммарно за месяц вычисляем общую сумму платежей
    let totalAllocated = monthPayments.reduce(
      (sum, item) => sum + item.payment,
      0
    );

    timelineRows.push({
      month: monthLabel,
      payments: monthPayments,
      totalPayment: totalAllocated,
      carryover: carryover,
    });

    // Переходим к следующему месяцу
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  displayResults(timelineRows);
}

// Вывод итогового плана в виде таблицы.
// Таблица содержит столбцы: Месяц, Цель (с детализацией платежей), Сумма внесена, Остаток.
function displayResults(timelineRows) {
  const resultsDiv = document.getElementById("simulationResults");
  resultsDiv.innerHTML = "";

  const table = document.createElement("table");
  table.className = "results-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr>
      <th><i class="ri-calendar-line"></i> Месяц</th>
      <th><i class="ri-flag-line"></i> Цель</th>
      <th>Накоплено всего</th>
      <th>Остаток цели</th>
      <th>Остаток платежа</th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  timelineRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.classList.add("fade-in-row");

    // В колонке "Цель" выводим только уникальные наименования целей (если платежей несколько, объединяем через запятую)
    let goalNames =
      row.payments.length > 0
        ? [...new Set(row.payments.map((p) => p.goalName))].join(", ")
        : "-";

    // "Накоплено всего" – суммарная сумма платежей за месяц
    let accumulated = row.totalPayment;
    // "Остаток цели" – суммарный остаток (для каждой цели: целевое – накопленное) в этом месяце
    let totalGoalRemainder = row.payments.reduce(
      (sum, p) => sum + p.remainder,
      0
    );
    // "Остаток платежа" – это carryover, который остался не израсходованным в этом месяце
    let carry = row.carryover;

    tr.innerHTML = `<td>${row.month}</td>
        <td class="goal-summary" data-goal="${goalNames}">${goalNames}</td>
        <td>${formatRUB(accumulated)}</td>
        <td>${formatRUB(totalGoalRemainder)}</td>
        <td>${formatRUB(carry)}</td>`;

    // При клике на ячейку с наименованием цели открывается модальное окно с подробностями (для примера берётся первая цель месяца)
    tr.querySelector(".goal-summary").addEventListener("click", function () {
      if (row.payments.length > 0) {
        openModal(row.payments[0]);
      }
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  resultsDiv.appendChild(table);

  // Дополнительный блок с пояснением (можно доработать при необходимости)
  const detailsDiv = document.createElement("div");
  detailsDiv.className = "month-details";
  detailsDiv.innerHTML =
    "<p>Подробная история накоплений по месяцам приведена в таблице выше.</p>";
  resultsDiv.appendChild(detailsDiv);
}

// Открытие модального окна с карточкой цели
function openModal(paymentData) {
  const modalOverlay = document.getElementById("modalOverlay");
  const modalContent = document.getElementById("modalContent");
  let progressPercent = Math.min(
    100,
    (
      (paymentData.cumulative /
        (paymentData.cumulative + paymentData.remainder)) *
      100
    ).toFixed(0)
  );
  modalContent.innerHTML = `
    <div class="modal-content-item">
      <h2><i class="ri-flag-line"></i> ${paymentData.goalName}</h2>
    </div>
    <div class="modal-content-item">
      <strong>Внесено в этом платеже:</strong> ${formatRUB(paymentData.payment)}
    </div>
    <div class="modal-content-item">
      <strong>Накоплено всего:</strong> ${formatRUB(paymentData.cumulative)}
    </div>
    <div class="modal-content-item">
      <strong>Остаток:</strong> ${formatRUB(paymentData.remainder)}
    </div>
    <div class="modal-content-item">
      <strong>Прогресс:</strong> ${progressPercent}%
      <div class="progress-container">
        <div class="progress-bar" style="width: ${progressPercent}%;"></div>
      </div>
    </div>
  `;
  modalOverlay.style.display = "flex";
}

// Закрытие модального окна
document.getElementById("modalClose").addEventListener("click", function () {
  document.getElementById("modalOverlay").style.display = "none";
});

// Реализация drag & drop для переупорядочивания целей
function initDragAndDrop() {
  const list = document.getElementById("goalsList");
  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", this.innerHTML);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = "move";
    return false;
  }

  function handleDragEnter(e) {
    this.classList.add("over");
  }

  function handleDragLeave(e) {
    this.classList.remove("over");
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    if (dragSrcEl !== this) {
      const srcIndex = parseInt(dragSrcEl.dataset.index);
      const targetIndex = parseInt(this.dataset.index);
      const temp = goals[srcIndex];
      goals[srcIndex] = goals[targetIndex];
      goals[targetIndex] = temp;
      updateGoalsUI();
      simulatePlan();
    }
    return false;
  }

  function handleDragEnd(e) {
    this.classList.remove("dragging");
    const items = list.querySelectorAll(".goal-item");
    items.forEach(function (item) {
      item.classList.remove("over");
    });
  }

  const items = list.querySelectorAll(".goal-item");
  items.forEach(function (item) {
    item.addEventListener("dragstart", handleDragStart, false);
    item.addEventListener("dragenter", handleDragEnter, false);
    item.addEventListener("dragover", handleDragOver, false);
    item.addEventListener("dragleave", handleDragLeave, false);
    item.addEventListener("drop", handleDrop, false);
    item.addEventListener("dragend", handleDragEnd, false);
  });
}

// Обработчики для формы и кнопок
document.getElementById("addGoalForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("goalName").value.trim();
  const target = Number(document.getElementById("goalTarget").value);
  const type = document.getElementById("goalType").value || "flexible";
  let months = null;
  if (type === "regular") {
    months = Number(document.getElementById("goalMonths").value);
    if (!months || months <= 0) {
      alert("Укажите корректное количество месяцев для регулярного платежа.");
      return;
    }
  }
  const comment = document.getElementById("goalComment").value.trim();
  // Фиксируем дату создания цели (формат YYYY-MM-DD)
  const createdDate = new Date().toISOString().slice(0, 10);
  if (name && target > 0) {
    goals.push({ name, target, type, months, comment, createdDate });
    updateGoalsUI();
    simulatePlan();
    this.reset();
  }
});

document
  .getElementById("simulateButton")
  .addEventListener("click", simulatePlan);

document.getElementById("toggleDetails").addEventListener("click", function () {
  const details = document.querySelector(".month-details");
  details.style.display =
    details.style.display === "none" || details.style.display === ""
      ? "block"
      : "none";
});

document
  .getElementById("saveGoalsJson")
  .addEventListener("click", saveGoalsToJson);

document.getElementById("loadGoalsJson").addEventListener("click", function () {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    loadGoalsFromFile(file);
  }
  this.value = "";
});
