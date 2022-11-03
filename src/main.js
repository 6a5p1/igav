(async () => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoiYXRlcml6YXJlaWdhdiIsImEiOiJjbDl4emc4aHcwZnlsM29wbmRscm5mMXkyIn0.Gdeb0G6Kd6NmfI8GHdJ6hQ";

  const LS = "igav";
  const IS_ADMIN = true;

  const invert = ([a, b]) => [b, a];
  const node = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.firstChild;
  };
  const trigger = (element, name, data) => {
    const event = document.createEvent("HTMLEvents");
    event.initEvent(name, true, true);
    event.data = data;
    element.dispatchEvent(event);
  };
  const uuidv4 = () => {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    );
  };
  const getPins = async () => {
    return new Promise((resolve) => {
      let response = [];
      try {
        response = JSON.parse(localStorage.getItem(LS)) || [];
      } catch (e) {}
      return resolve(response);
    });
  };
  const setPins = async (pins = []) => {
    return new Promise((resolve) => {
      localStorage.setItem(LS, JSON.stringify(pins));
      return resolve();
    });
  };

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v10",
    center: invert([46, 24.9]),
    zoom: 6.2,
  });

  map.addControl(new mapboxgl.NavigationControl());

  let pins = [];
  try {
    pins = await getPins();
  } catch (e) {
    console.error(e);
  }

  const markers = {};

  const addPinToMap = (pin) => {
    // create the popup
    const html = `<h5>${pin.text}</h5>${
      pin.files?.[0]
        ? `<div>
            <a href="${pin.files[0]}" target="_blank">deschide</a>
        </div>`
        : ""
    }`;
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false,
    }).setHTML(html);
    popup.on("open", () => trigger(document.body, "pin-change", pin));
    popup.on("close", () => trigger(document.body, "pin-change", null));

    // create DOM element for the marker
    const el = document.createElement("div");
    el.className = "marker";

    // create the marker
    markers[pin.id] = new mapboxgl.Marker(el)
      .setLngLat(pin.location)
      .setPopup(popup) // sets a popup on this marker
      .addTo(map);
  };

  pins.forEach(addPinToMap);

  (() => {
    // searchbox
    const form = node(`<form class="form-group main-search-form">
        <button class="btn btn-default" type="submit">🔎</button>
        <input class="form-control" name="search" type="search" placeholder="Search..." />
      </form>`);

    let offset = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = new RegExp(e.target.search.value, "i");

      for (let i = 0; i < pins.length; i++) {
        const pointer = (i + offset) % pins.length;
        const pin = pins[pointer];
        if (pin.text.search(val) !== -1) {
          map.flyTo({
            center: pin.location,
            zoom: 3,
            essential: true, // this animation is considered essential with respect to prefers-reduced-motion
          });
          offset = (pointer + 1) % pins.length;
          break;
        }
      }
    });
    document.body.appendChild(form);
  })();

  (() => {
    if (!IS_ADMIN) return false;
    // admin panel

    const renderForm = (pin) => {
      pin = pin || {};
      return `
        ${
          pin.id
            ? `<input type="hidden" name="identfier" value="${pin.id}">`
            : ""
        }
        <div class="d-flex flex-column mb-2">
            <label class="control-label">Text</label>
            <input class="form-control" type="text" placeholder="Bucuresti, spitalul Militar" name="text" value="${
              pin.text || ""
            }" required />
        </div>
        <div class="d-flex flex-column mb-2">
            <label class="control-label">File</label>
            <input class="form-control" type="url" placeholder="https://link-to-pdf" name="file" value="${
              pin.files?.[0] || ""
            }" required />
        </div>
        <div class="d-flex flex-column mb-2">
            <label class="control-label">Latitude</label>
            <input class="form-control" type="text" placeholder="46.01234" name="latitude" value="${
              pin.location?.[1] || ""
            }" required />
        </div>
        <div class="d-flex flex-column mb-2">
            <label class="control-label">Longitude</label>
            <input class="form-control" type="text" placeholder="27.01234" name="longitude"  value="${
              pin.location?.[0] || ""
            }" required />
        </div>
        ${
          pin.id
            ? `<div class="d-flex flex-column mt-2">
                <button class="btn btn-primary" type="submit">Update</button>
              </div>
              <div class="d-flex flex-column mt-1">
                <button class="btn btn-danger btn-delete" type="button">Delete</button>
              </div>`
            : `<div class="d-flex flex-column mt-2">
                <button class="btn btn-success" type="submit">Add</button>
              </div>`
        }
    `;
    };

    const admin = node(`<div class="admin-panel">
        <div class="mb-2 d-flex w-100 align-items-center justify-content-between">
            <h5 class="mb-0">Admin Panel</h5>
            <button type="button" class="btn btn-secondary btn-collapse">👁</button>
        </div>
        <form class="admin-add-form"></form>
        <div class="d-flex flex-column mt-5">
            <button class="btn btn-secondary js-export" type="button">Export JSON</button>
        </div>
    </div>`);

    document.body.appendChild(admin);

    const btnCollapse = admin.querySelector(".btn-collapse");
    btnCollapse.addEventListener("click", (e) => {
      e.preventDefault();
      admin.classList.toggle("active");
    });

    const form = admin.querySelector("form");

    const updateForm = (pin) => {
      form.innerHTML = renderForm(pin);

      const deleteBtn = form.querySelector(".btn-delete");
      if (!deleteBtn) return;

      const id = form.identfier?.value;
      if (!id) return;

      deleteBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (confirm("Are you sure you want to delete this?")) {
          const pinIndex = pins.findIndex((pin) => pin.id === id);
          if (pinIndex !== -1) {
            markers[pins[pinIndex].id]?.remove?.();
            pins.splice(pinIndex, 1);
          }
          await setPins(pins);
          form.reset();
          updateForm(null);
        }
      });
    };
    updateForm();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = form.identfier?.value || uuidv4();
      const text = form.text.value;
      const files = [form.file.value];
      const location = [
        Number(form.longitude.value),
        Number(form.latitude.value),
      ];
      const newPin = { id, text, files, location };
      if (form.identfier) {
        // already exists
        const pinIndex = pins.findIndex((pin) => pin.id === id);
        if (pinIndex !== -1) {
          pins[pinIndex] = {
            ...pins[pinIndex],
            ...newPin,
          };
          markers[pins[pinIndex].id]?.remove?.();
          addPinToMap(pins[pinIndex]);
        }
      } else {
        pins.push(newPin);
        addPinToMap(newPin);
      }
      await setPins(pins);
      form.reset();
      updateForm(null);
    });

    const exportBtn = admin.querySelector(".js-export");
    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(pins, null, 2)], {
          type: "text/plain",
        })
      );
      a.setAttribute("download", "pins.json");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    document.body.addEventListener("pin-change", ({ data }) => {
      updateForm(data);
    });
  })();
})();
