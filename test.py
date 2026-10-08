ciphertext = "YMJ XJHWJY BTWI NX MFHPJW"

# Try all 26 possible shifts (keys)
for key in range(1, 27):
  decoded_message = ""

  for char in ciphertext:
    # If it's a letter, shift it backward through the alphabet
    if char.isalpha():
      # Convert letter to a number (0-25)
      num = ord(char) - ord("A")
      # Shift it and wrap around using % 26
      new_num = (num - key) % 26
      # Convert back to a letter
      decoded_message += chr(new_num + ord("A"))
    else:
      # Keep spaces exactly as they are
      decoded_message += char

  # Print the key and the result
  print(f"Key {key:2d}: {decoded_message}")
