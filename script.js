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
  goalTypeSelect.value = "flexible";

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
      desc += `<br><i class="ri-time-line"></i> Гибкий платеж`;
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

/* 
Симуляция плана накоплений с детальной разбивкой операций:
- Каждый месяц доступна сумма monthlyContribution.
- В рамках месяца цели обрабатываются по порядку (сначала regular, затем flexible).
- Для каждой операции (выделения части платежа в цель) создаётся строка с информацией:
  • Месяц
  • Цель (название)
  • Расход на цели (сумма, направленная в эту операцию)
  • Остаток цели (сколько осталось накопить для закрытия данной цели)
  • Остаток от платежа (средства, оставшиеся из monthlyContribution после данной операции)
  • Общий остаток по всем целям – суммарное, оставшееся для всех целей (после данной операции)
- Если значение для «Остаток цели», «Остаток от платежа» или «Общий остаток по всем целям» равно 0, ячейка остаётся пустой.
- Строки для «Свободных средств» не создаются.
*/
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
  // Создаём копии целей для симуляции: если не задана createdDate – берём текущую дату
  // Обнуляем накопление (current) для симуляции.
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

  const maxMonths = 200;
  let monthCount = 0;
  // Массив строк для итоговой таблицы – каждая строка соответствует одной операции
  let timelineRows = [];

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

    // В начале месяца доступно ровно monthlyContribution
    let available = monthlyContribution;

    // Обрабатываем цели типа "regular"
    simGoals.forEach((goal) => {
      if (
        goal.type === "regular" &&
        goal.current < goal.target &&
        currentDate >= goal.createdDate
      ) {
        // Определяем дату завершения регулярного платежа: createdDate + months
        let dueDate = new Date(goal.createdDate);
        dueDate.setMonth(dueDate.getMonth() + goal.months);
        // Если текущая дата меньше dueDate, плановый платёж равен target/months, иначе 0
        let plannedPayment =
          currentDate < dueDate ? goal.target / goal.months : 0;
        if (plannedPayment > 0 && available > 0) {
          let required = goal.target - goal.current;
          let payment = Math.min(plannedPayment, required, available);
          if (payment > 0) {
            goal.current += payment;
            available -= payment;
            // Рассчитываем суммарный Общий остаток по всем целям после операции
            const globalRemaining = simGoals.reduce(
              (sum, g) => sum + (g.target - g.current),
              0
            );
            timelineRows.push({
              month: monthLabel,
              goalName: goal.name,
              payment: payment,
              totalGoalRemainder: goal.target - goal.current,
              remainderFromPayment: available,
              globalRemaining: globalRemaining,
            });
          }
        }
      }
    });

    // Обрабатываем цели типа "flexible"
    simGoals.forEach((goal) => {
      if (
        goal.type === "flexible" &&
        goal.current < goal.target &&
        currentDate >= goal.createdDate &&
        available > 0
      ) {
        let required = goal.target - goal.current;
        let payment = Math.min(required, available);
        if (payment > 0) {
          goal.current += payment;
          available -= payment;
          const globalRemaining = simGoals.reduce(
            (sum, g) => sum + (g.target - g.current),
            0
          );
          timelineRows.push({
            month: monthLabel,
            goalName: goal.name,
            payment: payment,
            totalGoalRemainder: goal.target - goal.current,
            remainderFromPayment: available,
            globalRemaining: globalRemaining,
          });
        }
      }
    });

    // Переходим к следующему месяцу
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  displayResults(timelineRows);
}

// Вывод итогового плана в виде таблицы.
// Столбцы: Месяц, Цель, Расход на цели, Остаток цели, Остаток от платежа, Общий остаток по всем целям.
// Если значение для "Остаток цели", "Остаток от платежа" или "Общий остаток по всем целям" равно 0, ячейка остаётся пустой.
function displayResults(timelineRows) {
  const resultsDiv = document.getElementById("simulationResults");
  resultsDiv.innerHTML = "";

  const table = document.createElement("table");
  table.className = "results-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr>
      <th><i class="ri-calendar-line"></i> Месяц</th>
      <th><i class="ri-flag-line"></i> Цель</th>
      <th>Расход на цели</th>
      <th>Остаток цели</th>
      <th>Остаток от платежа</th>
      <th>Общий остаток по всем целям</th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  timelineRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.classList.add("fade-in-row");

    let goalRemainderDisplay =
      row.totalGoalRemainder === 0 ? "" : formatRUB(row.totalGoalRemainder);
    let paymentRemainderDisplay =
      row.remainderFromPayment === 0 ? "" : formatRUB(row.remainderFromPayment);
    let globalRemainingDisplay =
      row.globalRemaining === 0 ? "" : formatRUB(row.globalRemaining);

    tr.innerHTML = `<td>${row.month}</td>
        <td class="goal-summary" data-goal="${row.goalName}">${
      row.goalName
    }</td>
        <td>${formatRUB(row.payment)}</td>
        <td>${goalRemainderDisplay}</td>
        <td>${paymentRemainderDisplay}</td>
        <td>${globalRemainingDisplay}</td>`;

    // По клику на название цели открывается модальное окно с подробностями операции
    tr.querySelector(".goal-summary").addEventListener("click", function () {
      openModal(row);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  resultsDiv.appendChild(table);

  const detailsDiv = document.createElement("div");
  detailsDiv.className = "month-details";
  detailsDiv.innerHTML =
    "<p>Подробная история накоплений по месяцам приведена в таблице выше.</p>";
  resultsDiv.appendChild(detailsDiv);
}

// Открытие модального окна с карточкой цели (подробности операции)
function openModal(paymentData) {
  const modalOverlay = document.getElementById("modalOverlay");
  const modalContent = document.getElementById("modalContent");
  // Рассчитываем процент выполнения для цели (если остаток цели не пустой)
  let progressPercent =
    paymentData.totalGoalRemainder !== ""
      ? Math.min(
          100,
          (paymentData.payment /
            (paymentData.payment + paymentData.totalGoalRemainder)) *
            100
        ).toFixed(0)
      : 100;
  modalContent.innerHTML = `
    <div class="modal-content-item">
      <h2><i class="ri-flag-line"></i> ${paymentData.goalName}</h2>
    </div>
    <div class="modal-content-item">
      <strong>Внесено в операции:</strong> ${formatRUB(paymentData.payment)}
    </div>
    <div class="modal-content-item">
      <strong>Остаток цели:</strong> ${
        paymentData.totalGoalRemainder === 0
          ? ""
          : formatRUB(paymentData.totalGoalRemainder)
      }
    </div>
    <div class="modal-content-item">
      <strong>Остаток от платежа:</strong> ${
        paymentData.remainderFromPayment === 0
          ? ""
          : formatRUB(paymentData.remainderFromPayment)
      }
    </div>
    <div class="modal-content-item">
      <strong>Общий остаток по всем целям:</strong> ${
        paymentData.globalRemaining === 0
          ? ""
          : formatRUB(paymentData.globalRemaining)
      }
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
