//! Windows raw mouse input (WM_INPUT) for unaccelerated deltas + sensitivity.
//!
//! Tao already pumps the top-level window's messages, so we piggyback on that
//! loop: register the mouse for raw input on the window's HWND, subclass its
//! WndProc, and accumulate the relative deltas from WM_INPUT. The frontend polls
//! `take_raw_mouse_delta` each frame while a round is active.
//!
//! Everything Windows-specific lives in `imp` behind `cfg(windows)`; other
//! platforms get no-op command stubs (`start_raw_input` returns false, so the
//! frontend falls back to its 1:1 confined-absolute cursor).

use tauri::{AppHandle, Runtime};

#[cfg(windows)]
mod imp {
  use std::sync::atomic::{AtomicBool, AtomicI32, AtomicIsize, Ordering};
  use raw_window_handle::{HasWindowHandle, RawWindowHandle};
  use tauri::{AppHandle, Manager, Runtime};
  use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
  use windows::Win32::UI::Input::{
    GetRawInputData, RegisterRawInputDevices, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE,
    RAWINPUTHEADER, RID_INPUT, RIDEV_INPUTSINK, RIM_TYPEMOUSE,
  };
  use windows::Win32::UI::WindowsAndMessaging::{
    CallWindowProcW, GetAncestor, SetWindowLongPtrW, GA_ROOT, GWLP_WNDPROC,
    WM_INPUT, WNDPROC,
  };

  static CAPTURING: AtomicBool = AtomicBool::new(false);
  static INSTALLED: AtomicBool = AtomicBool::new(false);
  static LOGGED_INPUT: AtomicBool = AtomicBool::new(false);
  static LOGGED_DELTA: AtomicBool = AtomicBool::new(false);
  static RAW_DX: AtomicI32 = AtomicI32::new(0);
  static RAW_DY: AtomicI32 = AtomicI32::new(0);
  // The window's original WndProc, which we chain to for every message.
  static ORIGINAL_WNDPROC: AtomicIsize = AtomicIsize::new(0);

  // MOUSE_MOVE_ABSOLUTE flag on RAWMOUSE.usFlags; its absence means relative.
  const MOUSE_MOVE_ABSOLUTE: u16 = 0x01;

  unsafe extern "system" fn subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
  ) -> LRESULT {
    if msg == WM_INPUT && CAPTURING.load(Ordering::Relaxed) {
      if !LOGGED_INPUT.swap(true, Ordering::Relaxed) {
        eprintln!("[raw] first WM_INPUT received");
      }
      let header_size = std::mem::size_of::<RAWINPUTHEADER>() as u32;
      let mut size: u32 = 0;
      GetRawInputData(
        HRAWINPUT(lparam.0 as *mut _),
        RID_INPUT,
        None,
        &mut size,
        header_size,
      );
      if size > 0 {
        let mut buf = vec![0u8; size as usize];
        let read = GetRawInputData(
          HRAWINPUT(lparam.0 as *mut _),
          RID_INPUT,
          Some(buf.as_mut_ptr() as *mut _),
          &mut size,
          header_size,
        );
        if read == size {
          let raw = &*(buf.as_ptr() as *const RAWINPUT);
          if raw.header.dwType == RIM_TYPEMOUSE.0 {
            let mouse = raw.data.mouse;
            if mouse.usFlags.0 & MOUSE_MOVE_ABSOLUTE == 0 {
              if !LOGGED_DELTA.swap(true, Ordering::Relaxed) {
                eprintln!(
                  "[raw] first delta dx={} dy={}",
                  mouse.lLastX, mouse.lLastY
                );
              }
              RAW_DX.fetch_add(mouse.lLastX, Ordering::Relaxed);
              RAW_DY.fetch_add(mouse.lLastY, Ordering::Relaxed);
            }
          }
        }
      }
    }

    let original: WNDPROC =
      std::mem::transmute(ORIGINAL_WNDPROC.load(Ordering::Relaxed));
    CallWindowProcW(original, hwnd, msg, wparam, lparam)
  }

  fn install(hwnd: HWND) {
    if INSTALLED.swap(true, Ordering::SeqCst) {
      return;
    }
    unsafe {
      // Target the top-level window (the message loop's window), not the
      // WebView2 child.
      let hwnd = GetAncestor(hwnd, GA_ROOT);
      let device = RAWINPUTDEVICE {
        usUsagePage: 0x01, // generic desktop
        usUsage: 0x02,     // mouse
        // INPUTSINK: deliver WM_INPUT to our window even though the WebView2
        // child holds keyboard focus.
        dwFlags: RIDEV_INPUTSINK,
        hwndTarget: hwnd,
      };
      let registered = RegisterRawInputDevices(
        &[device],
        std::mem::size_of::<RAWINPUTDEVICE>() as u32,
      );
      let prev =
        SetWindowLongPtrW(hwnd, GWLP_WNDPROC, subclass_proc as *const () as isize);
      ORIGINAL_WNDPROC.store(prev, Ordering::SeqCst);
      eprintln!(
        "[raw] install hwnd={:?} register={:?} prev_proc={:#x}",
        hwnd.0, registered, prev
      );
      if registered.is_err() {
        INSTALLED.store(false, Ordering::SeqCst);
      }
    }
  }

  pub fn setup<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
      return;
    };
    let Ok(handle) = window.window_handle() else {
      return;
    };
    if let RawWindowHandle::Win32(h) = handle.as_raw() {
      install(HWND(h.hwnd.get() as *mut _));
    }
  }

  pub fn start() -> bool {
    if !INSTALLED.load(Ordering::SeqCst) {
      return false;
    }
    RAW_DX.store(0, Ordering::Relaxed);
    RAW_DY.store(0, Ordering::Relaxed);
    CAPTURING.store(true, Ordering::Relaxed);
    true
  }

  pub fn stop() {
    CAPTURING.store(false, Ordering::Relaxed);
  }

  pub fn take() -> (i32, i32) {
    (
      RAW_DX.swap(0, Ordering::Relaxed),
      RAW_DY.swap(0, Ordering::Relaxed),
    )
  }
}

#[cfg(windows)]
pub fn setup<R: Runtime>(app: &AppHandle<R>) {
  imp::setup(app);
}

#[cfg(not(windows))]
pub fn setup<R: Runtime>(_app: &AppHandle<R>) {}

/// Begin capturing raw mouse deltas. Returns false where unsupported (non-Windows),
/// signalling the frontend to keep its 1:1 absolute cursor.
#[tauri::command]
pub fn start_raw_input() -> bool {
  #[cfg(windows)]
  {
    imp::start()
  }
  #[cfg(not(windows))]
  {
    false
  }
}

#[tauri::command]
pub fn stop_raw_input() {
  #[cfg(windows)]
  {
    imp::stop();
  }
}

/// Accumulated raw mouse delta since the last call, then reset to zero.
#[tauri::command]
pub fn take_raw_mouse_delta() -> (i32, i32) {
  #[cfg(windows)]
  {
    imp::take()
  }
  #[cfg(not(windows))]
  {
    (0, 0)
  }
}
