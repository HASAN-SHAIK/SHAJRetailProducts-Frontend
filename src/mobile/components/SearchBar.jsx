const SearchBar = ({ value, onChange, placeholder }) => {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] text-white placeholder:text-white/40 focus:border-[#38BDF8] focus:outline-none"
    />
  );
};

export default SearchBar;
