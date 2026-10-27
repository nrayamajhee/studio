use super::Event;

/// Preallocated queue sorted by frame; equal frames keep arrival order.
pub struct EventQueue {
  frames: Vec<f64>,
  events: Vec<Option<Event>>,
  head: usize,
  tail: usize,
}

impl EventQueue {
  pub fn new(capacity: usize) -> Self {
    Self {
      frames: vec![0.; capacity],
      events: vec![None; capacity],
      head: 0,
      tail: 0,
    }
  }

  pub fn push(&mut self, event: Event, frame: f64) -> bool {
    let capacity = self.frames.len();
    if self.tail == capacity {
      if self.head == 0 {
        return false;
      }
      self.frames.copy_within(self.head..self.tail, 0);
      self.events.copy_within(self.head..self.tail, 0);
      self.tail -= self.head;
      self.head = 0;
    }
    let mut i = self.tail;
    self.tail += 1;
    while i > self.head && self.frames[i - 1] > frame {
      self.frames[i] = self.frames[i - 1];
      self.events[i] = self.events[i - 1];
      i -= 1;
    }
    self.frames[i] = frame;
    self.events[i] = Some(event);
    true
  }

  pub fn peek_frame(&self) -> f64 {
    if self.head < self.tail {
      self.frames[self.head]
    } else {
      f64::INFINITY
    }
  }

  pub fn pop(&mut self) -> Option<Event> {
    let event = self.events[self.head].take();
    self.head += 1;
    if self.head == self.tail {
      self.head = 0;
      self.tail = 0;
    }
    event
  }
}
