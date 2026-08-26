/*
 * Copyright (c) 2026 Jonathan Croxton
 * SPDX-License-Identifier: MIT
 */

#define DT_DRV_COMPAT zmk_behavior_caps_snake

#include <errno.h>
#include <stddef.h>

#include <zephyr/device.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/util.h>

#include <drivers/behavior.h>
#include <dt-bindings/zmk/caps_snake.h>
#include <zmk/behavior.h>
#include <zmk/event_manager.h>
#include <zmk/events/keycode_state_changed.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/hid.h>
#include <zmk/keymap.h>
#include <zmk/keys.h>

#ifndef ZMK_KEY_PARAM_DECODE
struct zmk_key_param {
    zmk_mod_flags_t modifiers;
    uint8_t page;
    uint16_t id;
};

#define ZMK_KEY_PARAM_DECODE(param)                                                                \
    (struct zmk_key_param) {                                                                       \
        .modifiers = SELECT_MODS(param), .page = ZMK_HID_USAGE_PAGE(param),                        \
        .id = ZMK_HID_USAGE_ID(param),                                                             \
    }
#endif

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

enum caps_snake_state {
    CAPS_SNAKE_STATE_OFF,
    CAPS_SNAKE_STATE_AUTO,
    CAPS_SNAKE_STATE_LOCKED,
};

struct key_list {
    size_t size;
    struct zmk_key_param keys[];
};

struct behavior_caps_snake_config {
    uint8_t layer;
    const struct key_list *continue_keys;
    bool ignore_alphas;
    bool ignore_numbers;
    bool ignore_modifiers;
};

struct behavior_caps_snake_data {
    enum caps_snake_state state;
};

#define CAPS_SNAKE_INSTANCE_COUNT DT_NUM_INST_STATUS_OKAY(DT_DRV_COMPAT)

static const struct device *caps_snake_devices[CAPS_SNAKE_INSTANCE_COUNT];
static size_t caps_snake_device_count;

static int set_caps_snake_state(const struct device *dev, enum caps_snake_state state) {
    const struct behavior_caps_snake_config *config = dev->config;
    struct behavior_caps_snake_data *data = dev->data;

    data->state = state;
    int err = state == CAPS_SNAKE_STATE_OFF ? zmk_keymap_layer_deactivate(config->layer)
                                             : zmk_keymap_layer_activate(config->layer);
    return err < 0 ? err : ZMK_BEHAVIOR_OPAQUE;
}

static int on_caps_snake_binding_pressed(struct zmk_behavior_binding *binding,
                                         struct zmk_behavior_binding_event event) {
    const struct device *dev = zmk_behavior_get_binding(binding->behavior_dev);

    switch (binding->param1) {
    case CAPS_SNAKE_AUTO:
        return set_caps_snake_state(dev, CAPS_SNAKE_STATE_AUTO);
    case CAPS_SNAKE_LOCK:
        return set_caps_snake_state(dev, CAPS_SNAKE_STATE_LOCKED);
    case CAPS_SNAKE_CANCEL:
        return set_caps_snake_state(dev, CAPS_SNAKE_STATE_OFF);
    default:
        LOG_WRN("Unknown CapsSnake action: %d", binding->param1);
        return -ENOTSUP;
    }
}

static int on_caps_snake_binding_released(struct zmk_behavior_binding *binding,
                                          struct zmk_behavior_binding_event event) {
    return ZMK_BEHAVIOR_OPAQUE;
}

static const struct behavior_driver_api behavior_caps_snake_driver_api = {
    .binding_pressed = on_caps_snake_binding_pressed,
    .binding_released = on_caps_snake_binding_released,
};

static bool key_list_contains(const struct key_list *list, uint16_t usage_page, zmk_key_t usage_id,
                              zmk_mod_flags_t modifiers) {
    for (size_t i = 0; i < list->size; i++) {
        const struct zmk_key_param *key = &list->keys[i];
        if (key->page == usage_page && key->id == usage_id &&
            (key->modifiers & modifiers) == key->modifiers) {
            return true;
        }
    }

    return false;
}

static bool is_alpha(uint16_t usage_page, zmk_key_t usage_id) {
    return usage_page == HID_USAGE_KEY && usage_id >= HID_USAGE_KEY_KEYBOARD_A &&
           usage_id <= HID_USAGE_KEY_KEYBOARD_Z;
}

static bool is_numeric(uint16_t usage_page, zmk_key_t usage_id) {
    if (usage_page != HID_USAGE_KEY) {
        return false;
    }

    return ((usage_id >= HID_USAGE_KEY_KEYBOARD_1_AND_EXCLAMATION &&
             usage_id <= HID_USAGE_KEY_KEYBOARD_0_AND_RIGHT_PARENTHESIS) ||
            (usage_id >= HID_USAGE_KEY_KEYPAD_1_AND_END &&
             usage_id <= HID_USAGE_KEY_KEYPAD_0_AND_INSERT)) ||
           usage_id == HID_USAGE_KEY_KEYPAD_00 || usage_id == HID_USAGE_KEY_KEYPAD_000;
}

static bool should_continue(const struct behavior_caps_snake_config *config,
                            const struct zmk_keycode_state_changed *event) {
    if (config->ignore_alphas && is_alpha(event->usage_page, event->keycode)) {
        return true;
    }
    if (config->ignore_numbers && is_numeric(event->usage_page, event->keycode)) {
        return true;
    }
    if (config->ignore_modifiers && is_mod(event->usage_page, event->keycode)) {
        return true;
    }

    zmk_mod_flags_t modifiers = event->implicit_modifiers | zmk_hid_get_explicit_mods();
    return key_list_contains(config->continue_keys, event->usage_page, event->keycode, modifiers);
}

static int caps_snake_keycode_state_changed_listener(const zmk_event_t *eh) {
    const struct zmk_keycode_state_changed *event = as_zmk_keycode_state_changed(eh);
    if (event == NULL || !event->state) {
        return ZMK_EV_EVENT_BUBBLE;
    }

    for (size_t i = 0; i < caps_snake_device_count; i++) {
        const struct device *dev = caps_snake_devices[i];
        const struct behavior_caps_snake_config *config = dev->config;
        struct behavior_caps_snake_data *data = dev->data;

        if (data->state == CAPS_SNAKE_STATE_AUTO && !should_continue(config, event)) {
            set_caps_snake_state(dev, CAPS_SNAKE_STATE_OFF);
        }
    }

    return ZMK_EV_EVENT_BUBBLE;
}

static int caps_snake_layer_state_changed_listener(const zmk_event_t *eh) {
    const struct zmk_layer_state_changed *event = as_zmk_layer_state_changed(eh);
    if (event == NULL || event->state) {
        return ZMK_EV_EVENT_BUBBLE;
    }

    for (size_t i = 0; i < caps_snake_device_count; i++) {
        const struct device *dev = caps_snake_devices[i];
        const struct behavior_caps_snake_config *config = dev->config;
        struct behavior_caps_snake_data *data = dev->data;

        if (config->layer == event->layer) {
            data->state = CAPS_SNAKE_STATE_OFF;
        }
    }

    return ZMK_EV_EVENT_BUBBLE;
}

ZMK_LISTENER(caps_snake_keycode_state, caps_snake_keycode_state_changed_listener);
ZMK_SUBSCRIPTION(caps_snake_keycode_state, zmk_keycode_state_changed);

ZMK_LISTENER(caps_snake_layer_state, caps_snake_layer_state_changed_listener);
ZMK_SUBSCRIPTION(caps_snake_layer_state, zmk_layer_state_changed);

static int behavior_caps_snake_init(const struct device *dev) {
    if (caps_snake_device_count >= ARRAY_SIZE(caps_snake_devices)) {
        return -ENOMEM;
    }

    caps_snake_devices[caps_snake_device_count++] = dev;
    return 0;
}

#define KEY_LIST_ITEM(i, n, prop) ZMK_KEY_PARAM_DECODE(DT_INST_PROP_BY_IDX(n, prop, i))
#define CAPS_SNAKE_INST(n)                                                                         \
    static const struct key_list caps_snake_continue_list_##n = {                                  \
        .size = DT_INST_PROP_LEN(n, continue_list),                                                \
        .keys = {LISTIFY(DT_INST_PROP_LEN(n, continue_list), KEY_LIST_ITEM, (, ), n,               \
                         continue_list)},                                                          \
    };                                                                                             \
    static const struct behavior_caps_snake_config behavior_caps_snake_config_##n = {              \
        .layer = DT_INST_PROP(n, layer),                                                           \
        .continue_keys = &caps_snake_continue_list_##n,                                            \
        .ignore_alphas = DT_INST_PROP(n, ignore_alphas),                                           \
        .ignore_numbers = DT_INST_PROP(n, ignore_numbers),                                         \
        .ignore_modifiers = DT_INST_PROP(n, ignore_modifiers),                                     \
    };                                                                                             \
    static struct behavior_caps_snake_data behavior_caps_snake_data_##n = {                        \
        .state = CAPS_SNAKE_STATE_OFF,                                                             \
    };                                                                                             \
    BEHAVIOR_DT_INST_DEFINE(n, behavior_caps_snake_init, NULL, &behavior_caps_snake_data_##n,       \
                            &behavior_caps_snake_config_##n, POST_KERNEL,                           \
                            CONFIG_KERNEL_INIT_PRIORITY_DEFAULT,                                   \
                            &behavior_caps_snake_driver_api);

DT_INST_FOREACH_STATUS_OKAY(CAPS_SNAKE_INST)
