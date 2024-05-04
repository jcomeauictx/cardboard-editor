#!/usr/bin/python3
'''
test that X is running and will display our windows
'''
from tkinter import Tk, ttk
window = Tk()
window.title('X test')
label = ttk.Label(window, text='X is running')
label.pack()
window.mainloop()
